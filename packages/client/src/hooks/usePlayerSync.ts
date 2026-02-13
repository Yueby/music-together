import { useEffect, useRef, type MutableRefObject } from 'react'
import type { Howl } from 'howler'
import { EVENTS } from '@music-together/shared'
import type { ScheduledPlayState } from '@music-together/shared'
import { usePlayerStore } from '@/stores/playerStore'
import { useRoomStore } from '@/stores/roomStore'
import { useSocketContext } from '@/providers/SocketProvider'
import { getServerTime } from '@/lib/clockSync'
import {
  SYNC_REQUEST_INTERVAL_MS,
  HOST_REPORT_INTERVAL_MS,
  DRIFT_HARD_SEEK_THRESHOLD_S,
  DRIFT_RATE_THRESHOLD_S,
  RATE_CORRECTION_FACTOR,
} from '@/lib/constants'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute the delay (ms) until `serverTimeToExecute`, using our
 * NTP-calibrated clock.  Returns 0 if the time has already passed.
 */
function scheduleDelay(serverTimeToExecute: number): number {
  return Math.max(0, serverTimeToExecute - getServerTime())
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** Manages playback sync: scheduled execution + host reporting + drift correction */
export function usePlayerSync(
  howlRef: MutableRefObject<Howl | null>,
  syncReadyRef: MutableRefObject<boolean>,
  soundIdRef: MutableRefObject<number | undefined>,
) {
  const { socket } = useSocketContext()
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime)

  // Pending scheduled action timers (so we can cancel on unmount / new action)
  const scheduledTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Guard timer that re-enables sync after a seek/hard-correction
  const syncGuardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearScheduled = () => {
    if (scheduledTimerRef.current) {
      clearTimeout(scheduledTimerRef.current)
      scheduledTimerRef.current = null
    }
  }

  const startSyncGuard = () => {
    if (syncGuardTimerRef.current) clearTimeout(syncGuardTimerRef.current)
    syncReadyRef.current = false
    syncGuardTimerRef.current = setTimeout(() => {
      syncGuardTimerRef.current = null
      syncReadyRef.current = true
    }, 500)
  }

  // -----------------------------------------------------------------------
  // Scheduled action handlers
  // -----------------------------------------------------------------------
  useEffect(() => {
    // -- SEEK ---------------------------------------------------------------
    const onSeek = (data: { playState: ScheduledPlayState }) => {
      clearScheduled()
      const delay = scheduleDelay(data.playState.serverTimeToExecute)

      scheduledTimerRef.current = setTimeout(() => {
        if (howlRef.current) {
          howlRef.current.seek(data.playState.currentTime)
          // Brief guard to prevent drift-correction from fighting the seek
          startSyncGuard()
        }
        setCurrentTime(data.playState.currentTime)
      }, delay)
    }

    // -- PAUSE --------------------------------------------------------------
    const onPause = (data: { playState: ScheduledPlayState }) => {
      clearScheduled()
      const delay = scheduleDelay(data.playState.serverTimeToExecute)

      scheduledTimerRef.current = setTimeout(() => {
        if (howlRef.current && soundIdRef.current !== undefined) {
          howlRef.current.pause(soundIdRef.current)
          // Sync to the server's authoritative time snapshot
          howlRef.current.seek(data.playState.currentTime)
          setCurrentTime(data.playState.currentTime)
        }
      }, delay)
    }

    // -- RESUME -------------------------------------------------------------
    const onResume = (data: { playState: ScheduledPlayState }) => {
      clearScheduled()
      const delay = scheduleDelay(data.playState.serverTimeToExecute)

      scheduledTimerRef.current = setTimeout(() => {
        if (!howlRef.current) return
        // Seek to the expected position at this moment
        if (data.playState.currentTime > 0) {
          howlRef.current.seek(data.playState.currentTime)
          setCurrentTime(data.playState.currentTime)
        }
        if (soundIdRef.current !== undefined) {
          howlRef.current.play(soundIdRef.current)
        } else {
          soundIdRef.current = howlRef.current.play()
        }
      }, delay)
    }

    // -- SYNC RESPONSE (drift correction) -----------------------------------
    const onSyncResponse = (data: { currentTime: number; isPlaying: boolean; serverTimestamp: number }) => {
      if (!howlRef.current || !syncReadyRef.current) return
      if (!howlRef.current.playing()) return

      // Use NTP-calibrated server time for accurate delay estimation
      const networkDelaySec = Math.max(0, Math.min(5, (getServerTime() - data.serverTimestamp) / 1000))
      const expectedTime = data.currentTime + (data.isPlaying ? networkDelaySec : 0)

      const currentSeek = howlRef.current.seek() as number
      const drift = expectedTime - currentSeek // positive = client is behind

      const absDrift = Math.abs(drift)

      if (absDrift > DRIFT_HARD_SEEK_THRESHOLD_S) {
        // Large drift: hard seek (rare with NTP sync)
        howlRef.current.seek(expectedTime)
        startSyncGuard()
      } else if (absDrift > DRIFT_RATE_THRESHOLD_S) {
        // Small drift: adjust playback rate to gradually catch up / slow down
        const rate = drift > 0
          ? 1 + RATE_CORRECTION_FACTOR   // client behind → speed up
          : 1 - RATE_CORRECTION_FACTOR   // client ahead → slow down
        howlRef.current.rate(rate)
      } else {
        // Within tolerance: ensure normal rate
        const currentRate = howlRef.current.rate()
        if (currentRate !== 1) {
          howlRef.current.rate(1)
        }
      }
    }

    socket.on(EVENTS.PLAYER_SEEK, onSeek)
    socket.on(EVENTS.PLAYER_PAUSE, onPause)
    socket.on(EVENTS.PLAYER_RESUME, onResume)
    socket.on(EVENTS.PLAYER_SYNC_RESPONSE, onSyncResponse)

    return () => {
      clearScheduled()
      if (syncGuardTimerRef.current) {
        clearTimeout(syncGuardTimerRef.current)
        syncGuardTimerRef.current = null
      }
      socket.off(EVENTS.PLAYER_SEEK, onSeek)
      socket.off(EVENTS.PLAYER_PAUSE, onPause)
      socket.off(EVENTS.PLAYER_RESUME, onResume)
      socket.off(EVENTS.PLAYER_SYNC_RESPONSE, onSyncResponse)
    }
  }, [socket, howlRef, syncReadyRef, soundIdRef, setCurrentTime])

  // -----------------------------------------------------------------------
  // Periodic sync request (client-initiated, fallback)
  // -----------------------------------------------------------------------
  useEffect(() => {
    const interval = setInterval(() => {
      socket.emit(EVENTS.PLAYER_SYNC_REQUEST)
    }, SYNC_REQUEST_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [socket])

  // -----------------------------------------------------------------------
  // Host progress reporting (calibrates server-side playState)
  // -----------------------------------------------------------------------
  useEffect(() => {
    const interval = setInterval(() => {
      const currentUser = useRoomStore.getState().currentUser
      if (currentUser?.role !== 'host') return
      if (howlRef.current?.playing()) {
        socket.emit(EVENTS.PLAYER_SYNC, {
          currentTime: howlRef.current.seek() as number,
        })
      }
    }, HOST_REPORT_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [socket, howlRef])
}
