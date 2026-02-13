import { useEffect, useRef, type MutableRefObject } from 'react'
import type { Howl } from 'howler'
import { EVENTS } from '@music-together/shared'
import type { PlayState } from '@music-together/shared'
import { usePlayerStore } from '@/stores/playerStore'
import { useRoomStore } from '@/stores/roomStore'
import { useSocketContext } from '@/providers/SocketProvider'
import {
  SYNC_READY_DELAY_MS,
  SYNC_REQUEST_INTERVAL_MS,
  HOST_REPORT_INTERVAL_MS,
  SYNC_DRIFT_THRESHOLD_S,
} from '@/lib/constants'

/** Manages playback sync: host reporting + client drift correction */
export function usePlayerSync(
  howlRef: MutableRefObject<Howl | null>,
  syncReadyRef: MutableRefObject<boolean>,
) {
  const { socket } = useSocketContext()
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime)
  const syncDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Listen for PLAYER_SEEK, PLAYER_SYNC_RESPONSE, PLAYER_PAUSE
  useEffect(() => {
    const clearSyncDelay = () => {
      if (syncDelayTimerRef.current) {
        clearTimeout(syncDelayTimerRef.current)
        syncDelayTimerRef.current = null
      }
    }

    const scheduleSyncReady = () => {
      clearSyncDelay()
      syncReadyRef.current = false
      syncDelayTimerRef.current = setTimeout(() => {
        syncReadyRef.current = true
        syncDelayTimerRef.current = null
      }, SYNC_READY_DELAY_MS)
    }

    const onSeek = (data: { playState: PlayState }) => {
      if (howlRef.current) {
        howlRef.current.seek(data.playState.currentTime)
        scheduleSyncReady()
      }
      setCurrentTime(data.playState.currentTime)
    }

    const onSyncResponse = (data: { currentTime: number; isPlaying: boolean; serverTimestamp: number }) => {
      if (!howlRef.current || !syncReadyRef.current) return
      if (!howlRef.current.playing()) return

      // Compensate for network latency (clamped to [0, 5s] for clock skew safety)
      const rawDelay = (Date.now() - data.serverTimestamp) / 1000
      const networkDelaySec = Math.max(0, Math.min(5, rawDelay))
      const adjustedTime = data.currentTime + (data.isPlaying ? networkDelaySec : 0)

      const currentSeek = howlRef.current.seek() as number
      const drift = Math.abs(currentSeek - adjustedTime)
      if (drift > SYNC_DRIFT_THRESHOLD_S) {
        howlRef.current.seek(adjustedTime)
        scheduleSyncReady()
      }
    }

    const onPause = () => {
      howlRef.current?.pause()
    }

    const onResume = () => {
      howlRef.current?.play()
    }

    socket.on(EVENTS.PLAYER_SEEK, onSeek)
    socket.on(EVENTS.PLAYER_SYNC_RESPONSE, onSyncResponse)
    socket.on(EVENTS.PLAYER_PAUSE, onPause)
    socket.on(EVENTS.PLAYER_RESUME, onResume)

    return () => {
      clearSyncDelay()
      socket.off(EVENTS.PLAYER_SEEK, onSeek)
      socket.off(EVENTS.PLAYER_SYNC_RESPONSE, onSyncResponse)
      socket.off(EVENTS.PLAYER_PAUSE, onPause)
      socket.off(EVENTS.PLAYER_RESUME, onResume)
    }
  }, [socket, howlRef, syncReadyRef, setCurrentTime])

  // Periodic sync request (client-initiated)
  useEffect(() => {
    const interval = setInterval(() => {
      socket.emit(EVENTS.PLAYER_SYNC_REQUEST)
    }, SYNC_REQUEST_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [socket])

  // Host progress reporting (hybrid sync)
  useEffect(() => {
    const interval = setInterval(() => {
      const currentUser = useRoomStore.getState().currentUser
      if (!currentUser?.isHost) return
      if (howlRef.current?.playing()) {
        socket.emit(EVENTS.PLAYER_SYNC, {
          currentTime: howlRef.current.seek() as number,
        })
      }
    }, HOST_REPORT_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [socket, howlRef])
}
