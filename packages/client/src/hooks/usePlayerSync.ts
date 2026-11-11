import { getServerTime, isCalibrated, getMedianRTT } from '@/lib/clockSync'
import {
  DRIFT_SEEK_THRESHOLD_MS,
  DRIFT_DEAD_ZONE_MS,
  DRIFT_RATE_KP,
  MAX_RATE_ADJUSTMENT,
  DRIFT_SMOOTH_ALPHA,
  CONDUCTOR_REPORT_INTERVAL_MS,
  CONDUCTOR_REPORT_FAST_INTERVAL_MS,
  CONDUCTOR_REPORT_FAST_DURATION_MS,
  MAX_NETWORK_DELAY_S,
  SYNC_REQUEST_INTERVAL_MS,
  SYNC_REQUEST_IDLE_INTERVAL_MS,
  SYNC_REQUEST_SLOWDOWN_CONFIRM_COUNT,
  DRIFT_GRACE_PERIOD_MS,
  DRIFT_SEEK_RTT_MARGIN_MS,
  HARD_SEEK_CONFIRM_COUNT,
} from '@/lib/constants'
import { lyricPlayerBridge } from '@/lib/lyricPlayerBridge'
import { setHowlPosition } from '@/lib/howlPosition'
import {
  getHardSeekThresholdMs,
  getScheduledPlaybackPosition,
  getSyncExpectedPosition,
  getSyncRequestIntervalMs,
  isDriftSettled,
  shouldRearmSyncRequest,
} from '@/lib/playbackSync'
import { cancelScheduledPlay } from '@/lib/scheduledPlayback'
import { useSocketContext } from '@/providers/SocketProvider'
import { usePlayerStore } from '@/stores/playerStore'
import { useRoomStore } from '@/stores/roomStore'
import type { ScheduledPlayState, ServerToClientEvents } from '@music-together/shared'
import { EVENTS } from '@music-together/shared'
import type { PlaybackSound } from '@/lib/PlaybackSound'
import { useEffect, useRef, type RefObject } from 'react'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute the delay (ms) until `serverTimeToExecute`, using our
 * NTP-calibrated clock.  Returns 0 if the time has already passed.
 * Falls back to 0 (immediate execution) when NTP is not yet calibrated
 * to avoid wildly inaccurate scheduling from uncorrected local clocks.
 */
function scheduleDelay(serverTimeToExecute: number): number {
  if (!isCalibrated()) return 0
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
 *   |smoothedDrift| > adaptive 500ms → confirmed hard seek (rare)
 *   |smoothedDrift| 30ms~hard threshold → proportional rate adjustment
 *                                         rate = 1 - clamp(drift * Kp, ±0.02)
 *   |smoothedDrift| < 30ms → normal rate 1.0x (dead zone)
 *
 * The EMA low-pass filter smooths noisy drift measurements to prevent
 * the control loop from oscillating between speed-up and slow-down.
 *
 * If a browser speed plugin (e.g. Global Speed) overrides the rate,
 * rate correction is automatically disabled and only hard seek is used.
 */
export function usePlayerSync(
  howlRef: RefObject<PlaybackSound | null>,
  soundIdRef: RefObject<number | undefined>,
  setDesiredPlayback: (shouldPlay: boolean, getSeekTime?: () => number) => void,
  setScheduledPlayback: (getSeekTime: () => number) => void,
) {
  const { socket } = useSocketContext()
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime)

  // Pending scheduled action timers (so we can cancel on unmount / new action)
  const scheduledTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Monotonic action ID — guards against stale setTimeout(fn, 0) callbacks
  // when rapid events arrive in the same event loop tick.
  const actionIdRef = useRef(0)
  // When true, rate() micro-adjustment is disabled (browser plugin detected)
  const rateDisabledRef = useRef(false)
  // Consecutive count of rate override detections (require 3 to confirm plugin)
  const rateOverrideCountRef = useRef(0)
  // Timer for the 50ms rate-override detection check (stored so we can clear it)
  const rateCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // EMA-smoothed drift value (seconds) — persists across sync responses
  const smoothedDriftRef = useRef(0)
  // When true, next sync response seeds EMA directly instead of blending,
  // avoiding the cold-start lag after pause/resume/new-track.
  const emaColdStartRef = useRef(true)
  // Timestamp when the current track started playing (for adaptive conductor reporting)
  const trackStartTimeRef = useRef(0)
  // Consecutive hard-seek triggers — require HARD_SEEK_CONFIRM_COUNT before actually seeking
  const hardSeekCountRef = useRef(0)
  // Consecutive in-dead-zone sync responses — gates the adaptive request slowdown
  const lowDriftStreakRef = useRef(0)
  // The sync-request effect owns the timer; the response handler can use this
  // callback to replace a previously scheduled slow poll after fresh drift.
  const rearmSyncRequestRef = useRef<(() => void) | null>(null)

  const isStaleAction = (playState: ScheduledPlayState) =>
    playState.revision < (useRoomStore.getState().room?.playState.revision ?? -1)

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
      if (isStaleAction(data.playState)) return
      // Keep an in-flight load paused until this action's execution time.
      setDesiredPlayback(false)
      cancelScheduledPlay()
      clearScheduled()
      const id = ++actionIdRef.current
      const delay = scheduleDelay(data.playState.serverTimeToExecute)

      scheduledTimerRef.current = setTimeout(() => {
        if (actionIdRef.current !== id) return // stale callback
        const getSeekTime = () => getScheduledPlaybackPosition(
          data.playState.currentTime,
          data.playState.serverTimeToExecute,
          isCalibrated() ? getServerTime() : Date.now(),
        )
        if (data.playState.isPlaying) setScheduledPlayback(getSeekTime)
        else setDesiredPlayback(false, () => data.playState.currentTime)
        const targetTime = data.playState.isPlaying ? getSeekTime() : data.playState.currentTime
        // A late load starts once from onload, using the elapsed position.
        if (howlRef.current && (!data.playState.isPlaying || howlRef.current.state() === 'loaded')) {
          setHowlPosition(howlRef.current, targetTime, soundIdRef.current)
          if (howlRef.current.rate() !== 1) howlRef.current.rate(1)
          if (data.playState.isPlaying) {
            if (!howlRef.current.playing()) {
              soundIdRef.current =
                soundIdRef.current !== undefined
                  ? howlRef.current.play(soundIdRef.current)
                  : howlRef.current.play()
            }
          } else if (howlRef.current.playing()) {
            howlRef.current.pause(soundIdRef.current)
          }
        }
        setCurrentTime(targetTime)
        lyricPlayerBridge.seek(targetTime)
        smoothedDriftRef.current = 0
        emaColdStartRef.current = true
        // Keep roomStore.playState in sync for recovery effect
        useRoomStore.getState().updateRoom({
          playState: {
            isPlaying: data.playState.isPlaying,
            currentTime: data.playState.currentTime,
            serverTimestamp: data.playState.serverTimestamp,
            revision: data.playState.revision,
          },
        })
      }, delay)
    }

    // -- PAUSE --------------------------------------------------------------
    const onPause = (data: { playState: ScheduledPlayState }) => {
      if (isStaleAction(data.playState)) return
      setDesiredPlayback(false)
      cancelScheduledPlay()
      clearScheduled()
      const id = ++actionIdRef.current
      const delay = scheduleDelay(data.playState.serverTimeToExecute)

      scheduledTimerRef.current = setTimeout(() => {
        if (actionIdRef.current !== id) return // stale callback
        setDesiredPlayback(false, () => data.playState.currentTime)
        if (howlRef.current) {
          if (soundIdRef.current !== undefined) howlRef.current.pause(soundIdRef.current)
          // Sync to the server's authoritative time snapshot even when the
          // preloaded sound has not started and has no sound ID yet.
          setHowlPosition(howlRef.current, data.playState.currentTime, soundIdRef.current)
          if (howlRef.current.rate() !== 1) howlRef.current.rate(1)
        }
        setCurrentTime(data.playState.currentTime)
        lyricPlayerBridge.seek(data.playState.currentTime)
        // Reset drift state — paused means no drift
        smoothedDriftRef.current = 0
        emaColdStartRef.current = true
        usePlayerStore.getState().setSyncDrift(0)
        // Keep roomStore.playState in sync for recovery effect
        useRoomStore.getState().updateRoom({
          playState: {
            isPlaying: data.playState.isPlaying,
            currentTime: data.playState.currentTime,
            serverTimestamp: data.playState.serverTimestamp,
            revision: data.playState.revision,
          },
        })
      }, delay)
    }

    // -- RESUME -------------------------------------------------------------
    const onResume = (data: { playState: ScheduledPlayState }) => {
      if (isStaleAction(data.playState)) return
      setDesiredPlayback(false)
      cancelScheduledPlay()
      clearScheduled()
      const id = ++actionIdRef.current
      const delay = scheduleDelay(data.playState.serverTimeToExecute)

      scheduledTimerRef.current = setTimeout(() => {
        if (actionIdRef.current !== id) return // stale callback
        const getSeekTime = () => getScheduledPlaybackPosition(
          data.playState.currentTime,
          data.playState.serverTimeToExecute,
          isCalibrated() ? getServerTime() : Date.now(),
        )
        setScheduledPlayback(getSeekTime)
        if (!howlRef.current) return
        const targetTime = getSeekTime()
        if (howlRef.current.state() === 'loaded') {
          setHowlPosition(howlRef.current, targetTime, soundIdRef.current)
          if (howlRef.current.rate() !== 1) howlRef.current.rate(1)
          if (soundIdRef.current !== undefined) {
            howlRef.current.play(soundIdRef.current)
          } else {
            soundIdRef.current = howlRef.current.play()
          }
        }
        setCurrentTime(targetTime)
        lyricPlayerBridge.seek(targetTime)
        smoothedDriftRef.current = 0
        emaColdStartRef.current = true
        // Keep roomStore.playState in sync for recovery effect
        useRoomStore.getState().updateRoom({
          playState: {
            isPlaying: data.playState.isPlaying,
            currentTime: data.playState.currentTime,
            serverTimestamp: data.playState.serverTimestamp,
            revision: data.playState.revision,
          },
        })
      }, delay)
    }

    // -- NEW TRACK (PLAYER_PLAY) ---------------------------------------------
    // When a new track loads, cancel any pending action from the previous track
    // so it doesn't accidentally seek/pause/resume the new Howl instance.
    // Also reset rate-disabled flag to give the new track a fresh chance.
    const onPlay = (data: { playState: ScheduledPlayState }) => {
      if (isStaleAction(data.playState)) return
      cancelScheduledPlay()
      clearScheduled()
      ++actionIdRef.current // invalidate any pending stale callbacks
      // A new track resets the rate; cancel any pending plugin-override check
      // that captured a stale target rate from the previous track.
      if (rateCheckTimerRef.current) {
        clearTimeout(rateCheckTimerRef.current)
        rateCheckTimerRef.current = null
      }
      rateDisabledRef.current = false
      rateOverrideCountRef.current = 0
      hardSeekCountRef.current = 0
      // A new track has unknown drift — re-arm the fast request interval.
      lowDriftStreakRef.current = 0
      smoothedDriftRef.current = 0
      emaColdStartRef.current = true
      trackStartTimeRef.current = Date.now()
    }

    // -- SYNC RESPONSE (proportional drift correction + EMA smoothing) ------
    type SyncResponse = Parameters<ServerToClientEvents[typeof EVENTS.PLAYER_SYNC_RESPONSE]>[0]
    const onSyncResponse = (data: SyncResponse) => {
      if (!howlRef.current) return
      if (!howlRef.current.playing()) return
      // Drift is measured against server-time extrapolation. Until NTP has converged,
      // getServerTime() is just the local clock, so a skewed device clock would look like
      // up to several seconds of drift and trigger a bogus cold-start hard seek.
      // Ignore the response without touching the EMA / cold-start state; the periodic
      // sync request keeps polling and the next response after calibration is used.
      if (!isCalibrated()) return

      // Only the elected conductor socket is authoritative. Other tabs that
      // share the same identity remain followers and must still self-correct.
      const { room: syncRoom } = useRoomStore.getState()
      if (syncRoom?.conductorSocketId === socket.id) return

      // Drop responses computed for a different track — an in-flight response
      // can race a track change (request sent for track A, room switched to B
      // before the server answered). Missing trackId (older server) is tolerated.
      const currentTrackId = syncRoom?.currentTrack?.id
      if (data.trackId != null && data.trackId !== currentTrackId) return

      // Grace period after new track: skip rate micro-adjustments
      // (estimateCurrentTime is unreliable until conductor submits at least
      // one progress report), but still allow hard seek for large drifts.
      const inGracePeriod = Date.now() - trackStartTimeRef.current < DRIFT_GRACE_PERIOD_MS

      const expectedTime = getSyncExpectedPosition(
        data.currentTime,
        data.isPlaying,
        data.serverTimestamp,
        getServerTime(),
        MAX_NETWORK_DELAY_S,
      )

      const currentSeek = howlRef.current.seek() as number
      const rawDrift = currentSeek - expectedTime

      // EMA low-pass filter: smooths noisy measurements to prevent oscillation.
      // On cold start (after pause/resume/new-track), seed with raw value
      // directly so the first correction is immediate, not dampened by stale 0.
      const wasColdStart = emaColdStartRef.current
      if (wasColdStart) {
        smoothedDriftRef.current = rawDrift
        emaColdStartRef.current = false
      } else {
        smoothedDriftRef.current = DRIFT_SMOOTH_ALPHA * rawDrift + (1 - DRIFT_SMOOTH_ALPHA) * smoothedDriftRef.current
      }
      const sd = smoothedDriftRef.current
      const absDrift = Math.abs(sd)

      // Adaptive sync-request frequency: only consecutive settled readings may
      // slow the request loop; any fresh drift re-arms the fast interval.
      const settled = isDriftSettled(absDrift, DRIFT_DEAD_ZONE_MS)
      const wasLowDrift = lowDriftStreakRef.current >= SYNC_REQUEST_SLOWDOWN_CONFIRM_COUNT
      if (settled) lowDriftStreakRef.current++
      else lowDriftStreakRef.current = 0
      if (shouldRearmSyncRequest(wasLowDrift, settled)) rearmSyncRequestRef.current?.()

      // Update store with smoothed value so UI shows stable drift reading
      usePlayerStore.getState().setSyncDrift(sd)

      // Adaptive hard-seek threshold: on high-latency links the NTP offset
      // error (asymmetric routing) and extrapolation jitter can easily reach
      // the static 200ms threshold, triggering repeated backward jumps.
      // Raising the threshold proportionally to the observed RTT avoids this.
      const medianRtt = getMedianRTT()
      const hardSeekThreshold =
        getHardSeekThresholdMs(DRIFT_SEEK_THRESHOLD_MS, medianRtt, DRIFT_SEEK_RTT_MARGIN_MS) / 1000

      if (absDrift > hardSeekThreshold) {
        // Only very large cold-start errors are corrected immediately. Borderline
        // media-clock bias must persist across multiple responses before a native
        // media seek is allowed because that operation can stall mobile audio.
        const requiredConfirmations =
          wasColdStart && absDrift > hardSeekThreshold * 2 ? 1 : HARD_SEEK_CONFIRM_COUNT
        hardSeekCountRef.current++
        if (hardSeekCountRef.current < requiredConfirmations) return
        // Confirmed: large sustained drift — hard seek
        hardSeekCountRef.current = 0
        setHowlPosition(howlRef.current, expectedTime, soundIdRef.current)
        if (howlRef.current.rate() !== 1) howlRef.current.rate(1)
        // A hard seek resets the rate — cancel any pending plugin-override
        // check that captured a stale target rate from a proportional step.
        if (rateCheckTimerRef.current) {
          clearTimeout(rateCheckTimerRef.current)
          rateCheckTimerRef.current = null
        }
        smoothedDriftRef.current = 0
        // A hard seek is itself a valid synchronization sample. Keep the EMA
        // warm so a persistent media-clock bias cannot trigger another seek on
        // every 2-second response and repeatedly stall HTML5 Audio on mobile.
        emaColdStartRef.current = false
        usePlayerStore.getState().setSyncDrift(0)
      } else if (absDrift > DRIFT_DEAD_ZONE_MS / 1000 && !rateDisabledRef.current) {
        // Drift fell below hard-seek threshold — reset consecutive counter
        // so only truly consecutive above-threshold measurements trigger a seek.
        hardSeekCountRef.current = 0
        // 宽限期内跳过 rate 微调 — 等 conductor report 稳定后再启用
        if (inGracePeriod) return
        // Proportional rate correction: larger drift → stronger correction,
        // naturally decelerating as we approach the target — no oscillation.
        const adj = clamp(sd * DRIFT_RATE_KP, MAX_RATE_ADJUSTMENT)
        const targetRate = 1 - adj
        if (Math.abs(howlRef.current.rate() - targetRate) > 0.001) {
          howlRef.current.rate(targetRate)
        }
        // Verify rate was applied — detect browser speed plugin interference.
        // Use setTimeout instead of rAF to avoid false positives when the tab
        // is in background (rAF is throttled/paused by browsers).
        // Require 3 consecutive detections to confirm a plugin, not just one.
        // Clear previous check timer to avoid stacking on rapid sync responses.
        if (rateCheckTimerRef.current) clearTimeout(rateCheckTimerRef.current)
        rateCheckTimerRef.current = setTimeout(() => {
          rateCheckTimerRef.current = null
          if (!howlRef.current) return
          if (Math.abs(howlRef.current.rate() - targetRate) > 0.005) {
            rateOverrideCountRef.current++
            if (rateOverrideCountRef.current >= 3) {
              rateDisabledRef.current = true
              console.warn(
                'Rate correction disabled: external plugin detected (confirmed after 3 consecutive overrides)',
              )
            }
          } else {
            // Rate applied successfully — reset counter
            rateOverrideCountRef.current = 0
          }
        }, 50)
      } else {
        // Within dead zone: ensure normal playback rate
        hardSeekCountRef.current = 0
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
      if (rateCheckTimerRef.current) {
        clearTimeout(rateCheckTimerRef.current)
        rateCheckTimerRef.current = null
      }
      socket.off(EVENTS.PLAYER_SEEK, onSeek)
      socket.off(EVENTS.PLAYER_PAUSE, onPause)
      socket.off(EVENTS.PLAYER_RESUME, onResume)
      socket.off(EVENTS.PLAYER_PLAY, onPlay)
      socket.off(EVENTS.PLAYER_SYNC_RESPONSE, onSyncResponse)
    }
  }, [socket, howlRef, soundIdRef, setCurrentTime, setDesiredPlayback, setScheduledPlayback])

  // -----------------------------------------------------------------------
  // Periodic sync request (client-initiated drift correction).
  // Host skips: it is the authoritative source and reports its own position.
  // Adaptive frequency: fast while drift is unsettled or the media is paused;
  // consecutive settled responses slow the loop to SYNC_REQUEST_IDLE_INTERVAL_MS.
  // -----------------------------------------------------------------------
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | null = null

    const scheduleNext = (delay: number) => {
      if (timerId) clearTimeout(timerId)
      timerId = setTimeout(request, delay)
    }

    const request = () => {
      const { room: r2 } = useRoomStore.getState()
      // Skip entirely outside a room; followers (incl. non-elected tabs of the
      // conductor identity) request drift correction, the conductor does not.
      if (r2 && r2.conductorSocketId !== socket.id) socket.emit(EVENTS.PLAYER_SYNC_REQUEST)
      const isPlaying = howlRef.current?.playing() ?? false
      scheduleNext(getSyncRequestIntervalMs(
          isPlaying,
          lowDriftStreakRef.current,
          SYNC_REQUEST_INTERVAL_MS,
          SYNC_REQUEST_IDLE_INTERVAL_MS,
          SYNC_REQUEST_SLOWDOWN_CONFIRM_COUNT,
        ))
    }

    rearmSyncRequestRef.current = () => scheduleNext(SYNC_REQUEST_INTERVAL_MS)
    scheduleNext(SYNC_REQUEST_INTERVAL_MS)
    return () => {
      if (timerId) clearTimeout(timerId)
      rearmSyncRequestRef.current = null
    }
  }, [socket, howlRef])

  // -----------------------------------------------------------------------
  // Conductor progress reporting (keeps server-side playState accurate for
  // mid-song joiners and reconnection recovery).
  // Adaptive: fast interval (2s) for the first 10s of a new track,
  // then slows to the normal interval (5s) to reduce overhead.
  // -----------------------------------------------------------------------
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | null = null

    const report = () => {
      const { room } = useRoomStore.getState()
      if (room && room.conductorSocketId === socket.id && room.currentTrack && howlRef.current?.playing()) {
        socket.emit(EVENTS.PLAYER_SYNC, {
          currentTime: howlRef.current.seek() as number,
          // Only attach a calibrated server-time anchor. While NTP is still
          // converging, omit it so the server falls back to its receive-time
          // anchor (bounded by one-way latency) instead of a skewed wall clock.
          hostServerTime: isCalibrated() ? getServerTime() : undefined,
          revision: room.playState.revision,
          trackId: room.currentTrack.id,
        })
        // Schedule next report — fast if within the initial window, slow otherwise
        const elapsed = Date.now() - trackStartTimeRef.current
        const interval =
          elapsed < CONDUCTOR_REPORT_FAST_DURATION_MS ? CONDUCTOR_REPORT_FAST_INTERVAL_MS : CONDUCTOR_REPORT_INTERVAL_MS
        timerId = setTimeout(report, interval)
      } else {
        // Not reporting right now (outside a room / not the elected conductor /
        // media paused): keep a slow heartbeat so the chain re-engages when the
        // role or playback state changes, without spinning at the fast interval.
        timerId = setTimeout(report, CONDUCTOR_REPORT_INTERVAL_MS)
      }
    }

    // When the tab returns from background, immediately send a conductor report
    // so the server's playState is refreshed after potential setTimeout throttling.
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      const { room: r } = useRoomStore.getState()
      if (r && r.conductorSocketId === socket.id && r.currentTrack && howlRef.current?.playing()) {
        socket.emit(EVENTS.PLAYER_SYNC, {
          currentTime: howlRef.current.seek() as number,
          hostServerTime: isCalibrated() ? getServerTime() : undefined,
          revision: r.playState.revision,
          trackId: r.currentTrack.id,
        })
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    timerId = setTimeout(report, CONDUCTOR_REPORT_FAST_INTERVAL_MS)

    return () => {
      if (timerId) clearTimeout(timerId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [socket, howlRef])
}
