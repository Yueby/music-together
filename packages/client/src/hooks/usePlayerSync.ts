import { getServerTime } from '@/lib/clockSync'
import {
  DRIFT_SEEK_THRESHOLD_MS,
  DRIFT_DEAD_ZONE_MS,
  DRIFT_RATE_KP,
  MAX_RATE_ADJUSTMENT,
  DRIFT_SMOOTH_ALPHA,
  DRIFT_PLUGIN_SEEK_THRESHOLD_MS,
  HOST_REPORT_INTERVAL_MS,
  HOST_REPORT_FAST_INTERVAL_MS,
  HOST_REPORT_FAST_DURATION_MS,
  MAX_NETWORK_DELAY_S,
  SYNC_REQUEST_INTERVAL_MS,
} from '@/lib/constants'
import { useSocketContext } from '@/providers/SocketProvider'
import { usePlayerStore } from '@/stores/playerStore'
import { useRoomStore } from '@/stores/roomStore'
import type { ScheduledPlayState } from '@music-together/shared'
import { EVENTS } from '@music-together/shared'
import type { Howl } from 'howler'
import { useEffect, useRef, type RefObject } from 'react'

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

/** Clamp a value between -limit and +limit. */
function clamp(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value))
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages playback sync via **event-driven Scheduled Execution**
 * with periodic **proportional drift correction + EMA smoothing**:
 *
 *   |smoothedDrift| > 200ms → hard seek (audible jump, rare)
 *   |smoothedDrift| 5~200ms → proportional rate adjustment
 *                              rate = 1 - clamp(drift * Kp, ±0.02)
 *   |smoothedDrift| < 5ms   → reset to normal rate 1.0x (dead zone)
 *
 * The EMA low-pass filter smooths noisy drift measurements to prevent
 * the control loop from oscillating between speed-up and slow-down.
 *
 * If a browser speed plugin (e.g. Global Speed) overrides the rate,
 * rate correction is automatically disabled and only hard seek is used.
 */
export function usePlayerSync(
  howlRef: RefObject<Howl | null>,
  soundIdRef: RefObject<number | undefined>,
) {
  const { socket } = useSocketContext()
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime)

  // Pending scheduled action timers (so we can cancel on unmount / new action)
  const scheduledTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // When true, rate() micro-adjustment is disabled (browser plugin detected)
  const rateDisabledRef = useRef(false)
  // Consecutive count of rate override detections (require 3 to confirm plugin)
  const rateOverrideCountRef = useRef(0)
  // EMA-smoothed drift value (seconds) — persists across sync responses
  const smoothedDriftRef = useRef(0)
  // Timestamp when the current track started playing (for adaptive host reporting)
  const trackStartTimeRef = useRef(0)

  const clearScheduled = () => {
    if (scheduledTimerRef.current) {
      clearTimeout(scheduledTimerRef.current)
      scheduledTimerRef.current = null
    }
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
          if (howlRef.current.rate() !== 1) howlRef.current.rate(1)
        }
        setCurrentTime(data.playState.currentTime)
        smoothedDriftRef.current = 0
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
          if (howlRef.current.rate() !== 1) howlRef.current.rate(1)
          setCurrentTime(data.playState.currentTime)
        }
        // Reset drift state — paused means no drift
        smoothedDriftRef.current = 0
        usePlayerStore.getState().setSyncDrift(0)
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
        if (howlRef.current.rate() !== 1) howlRef.current.rate(1)
        smoothedDriftRef.current = 0
        if (soundIdRef.current !== undefined) {
          howlRef.current.play(soundIdRef.current)
        } else {
          soundIdRef.current = howlRef.current.play()
        }
      }, delay)
    }

    // -- NEW TRACK (PLAYER_PLAY) ---------------------------------------------
    // When a new track loads, cancel any pending action from the previous track
    // so it doesn't accidentally seek/pause/resume the new Howl instance.
    // Also reset rate-disabled flag to give the new track a fresh chance.
    const onPlay = () => {
      clearScheduled()
      rateDisabledRef.current = false
      rateOverrideCountRef.current = 0
      smoothedDriftRef.current = 0
      trackStartTimeRef.current = Date.now()
    }

    // -- SYNC RESPONSE (proportional drift correction + EMA smoothing) ------
    const onSyncResponse = (data: { currentTime: number; isPlaying: boolean; serverTimestamp: number }) => {
      if (!howlRef.current) return
      if (!howlRef.current.playing()) return

      // Use NTP-calibrated server time for accurate delay estimation
      const networkDelaySec = Math.max(0, Math.min(MAX_NETWORK_DELAY_S, (getServerTime() - data.serverTimestamp) / 1000))
      const expectedTime = data.currentTime + (data.isPlaying ? networkDelaySec : 0)

      const currentSeek = howlRef.current.seek() as number
      const rawDrift = currentSeek - expectedTime

      // EMA low-pass filter: smooths noisy measurements to prevent oscillation
      smoothedDriftRef.current =
        DRIFT_SMOOTH_ALPHA * rawDrift + (1 - DRIFT_SMOOTH_ALPHA) * smoothedDriftRef.current
      const sd = smoothedDriftRef.current
      const absDrift = Math.abs(sd)

      // Update store with smoothed value so UI shows stable drift reading
      usePlayerStore.getState().setSyncDrift(sd)

      // When rate correction is disabled (plugin detected), use a lower
      // seek threshold so drifts don't go uncorrected.
      const hardSeekThreshold = rateDisabledRef.current
        ? DRIFT_PLUGIN_SEEK_THRESHOLD_MS / 1000
        : DRIFT_SEEK_THRESHOLD_MS / 1000

      if (absDrift > hardSeekThreshold) {
        // Large drift (or any noticeable drift when rate is disabled): hard seek
        howlRef.current.seek(expectedTime)
        if (howlRef.current.rate() !== 1) howlRef.current.rate(1)
        smoothedDriftRef.current = 0
      } else if (absDrift > DRIFT_DEAD_ZONE_MS / 1000 && !rateDisabledRef.current) {
        // Proportional rate correction: larger drift → stronger correction,
        // naturally decelerating as we approach the target — no oscillation.
        const adj = clamp(sd * DRIFT_RATE_KP, MAX_RATE_ADJUSTMENT)
        const targetRate = 1 - adj
        howlRef.current.rate(targetRate)
        // Verify rate was applied — detect browser speed plugin interference.
        // Use setTimeout instead of rAF to avoid false positives when the tab
        // is in background (rAF is throttled/paused by browsers).
        // Require 3 consecutive detections to confirm a plugin, not just one.
        setTimeout(() => {
          if (!howlRef.current) return
          if (Math.abs(howlRef.current.rate() - targetRate) > 0.005) {
            rateOverrideCountRef.current++
            if (rateOverrideCountRef.current >= 3) {
              rateDisabledRef.current = true
              console.warn('Rate correction disabled: external plugin detected (confirmed after 3 consecutive overrides)')
            }
          } else {
            // Rate applied successfully — reset counter
            rateOverrideCountRef.current = 0
          }
        }, 50)
      } else {
        // Within dead zone: ensure normal playback rate
        if (howlRef.current.rate() !== 1) howlRef.current.rate(1)
      }
    }

    socket.on(EVENTS.PLAYER_SEEK, onSeek)
    socket.on(EVENTS.PLAYER_PAUSE, onPause)
    socket.on(EVENTS.PLAYER_RESUME, onResume)
    socket.on(EVENTS.PLAYER_PLAY, onPlay)
    socket.on(EVENTS.PLAYER_SYNC_RESPONSE, onSyncResponse)

    return () => {
      clearScheduled()
      socket.off(EVENTS.PLAYER_SEEK, onSeek)
      socket.off(EVENTS.PLAYER_PAUSE, onPause)
      socket.off(EVENTS.PLAYER_RESUME, onResume)
      socket.off(EVENTS.PLAYER_PLAY, onPlay)
      socket.off(EVENTS.PLAYER_SYNC_RESPONSE, onSyncResponse)
    }
  }, [socket, howlRef, soundIdRef, setCurrentTime])

  // -----------------------------------------------------------------------
  // Periodic sync request (client-initiated drift correction)
  // -----------------------------------------------------------------------
  useEffect(() => {
    const interval = setInterval(() => {
      socket.emit(EVENTS.PLAYER_SYNC_REQUEST)
    }, SYNC_REQUEST_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [socket])

  // -----------------------------------------------------------------------
  // Host progress reporting (keeps server-side playState accurate for
  // mid-song joiners and reconnection recovery).
  // Adaptive: fast interval (2s) for the first 10s of a new track,
  // then slows to the normal interval (5s) to reduce overhead.
  // -----------------------------------------------------------------------
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | null = null

    const report = () => {
      const currentUser = useRoomStore.getState().currentUser
      if (currentUser?.role === 'host' && howlRef.current?.playing()) {
        socket.emit(EVENTS.PLAYER_SYNC, {
          currentTime: howlRef.current.seek() as number,
        })
      }
      // Schedule next report — fast if within the initial window, slow otherwise
      const elapsed = Date.now() - trackStartTimeRef.current
      const interval = elapsed < HOST_REPORT_FAST_DURATION_MS
        ? HOST_REPORT_FAST_INTERVAL_MS
        : HOST_REPORT_INTERVAL_MS
      timerId = setTimeout(report, interval)
    }

    timerId = setTimeout(report, HOST_REPORT_FAST_INTERVAL_MS)

    return () => {
      if (timerId) clearTimeout(timerId)
    }
  }, [socket, howlRef])
}
