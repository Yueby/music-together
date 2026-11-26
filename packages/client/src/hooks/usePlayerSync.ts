import { getServerTime, isCalibrated, getMedianRTT } from '@/lib/clockSync'
import {
  DRIFT_SEEK_THRESHOLD_MS,
  DRIFT_DEAD_ZONE_MS,
  DRIFT_RATE_KP,
  MAX_RATE_ADJUSTMENT,
  DRIFT_SMOOTH_ALPHA,
  SYNC_REQUEST_INTERVAL_MS,
  DRIFT_SAMPLE_INTERVAL_MS,
  DRIFT_SAMPLE_COUNT,
  DRIFT_SEEK_RTT_MARGIN_MS,
  HARD_SEEK_CONFIRM_COUNT,
  WEB_AUDIO_SEEK_THRESHOLD_MS,
  WEB_AUDIO_MAX_RATE_ADJUSTMENT,
} from '@/lib/constants'
import { lyricPlayerBridge } from '@/lib/lyricPlayerBridge'
import { setHowlPosition } from '@/lib/howlPosition'
import {
  compensatePlaybackPosition,
  getEffectiveAudioLatencyOffsetMs,
  getHardSeekThresholdMs,
  getCompensatedScheduledPosition,
  getSoundOutputLatencyMs,
  medianDrift,
} from '@/lib/playbackSync'
import { cancelScheduledPlay } from '@/lib/scheduledPlayback'
import { useSocketContext } from '@/providers/SocketProvider'
import { usePlayerStore } from '@/stores/playerStore'
import { canSendRoomCommand, useRoomStore } from '@/stores/roomStore'
import type { ScheduledPlayState, ServerToClientEvents } from '@music-together/shared'
import { EVENTS } from '@music-together/shared'
import type { PlaybackSound } from '@/lib/PlaybackSound'
import { useEffect, useRef, type RefObject } from 'react'

export function usePlayerSync(
  howlRef: RefObject<PlaybackSound | null>,
  soundIdRef: RefObject<number | undefined>,
  setDesiredPlayback: (shouldPlay: boolean, getSeekTime?: () => number) => void,
  setScheduledPlayback: (getSeekTime: () => number) => void,
  startPlayback?: (getSeekTime: () => number, delayMs?: number) => void,
) {
  const { socket } = useSocketContext()
  const pendingRevisionRef = useRef(-1)

  useEffect(() => {
    let scheduledTimer: ReturnType<typeof setTimeout> | undefined
    let lastPlayKey: string | undefined
    let anchorKey: string | undefined
    let lastEffectiveLatencyMs: number | undefined
    let samples: number[] = []
    let smoothedDrift: number | undefined
    let hardSeekCount = 0
    let rateCheckTimer: ReturnType<typeof setTimeout> | undefined
    let rateOverrideCount = 0
    let rateDisabled = false

    const clearWaitingLoadState = () => {
      if (usePlayerStore.getState().audioLoadPhase === 'waiting') {
        usePlayerStore.getState().setAudioLoadState({ phase: 'idle' })
      }
    }

    const clearScheduled = () => {
      clearTimeout(scheduledTimer)
      scheduledTimer = undefined
      pendingRevisionRef.current = -1
    }

    const resetDrift = () => {
      samples = []
      smoothedDrift = undefined
      hardSeekCount = 0
      clearTimeout(rateCheckTimer)
      usePlayerStore.getState().setSyncDrift(0)
    }

    const isStale = (revision: number) =>
      revision < Math.max(pendingRevisionRef.current, useRoomStore.getState().room?.playState.revision ?? -1)

    const scheduleAction = ({ playState }: { playState: ScheduledPlayState }) => {
      if (isStale(playState.revision)) return
      if (!playState.isPlaying) clearWaitingLoadState()
      setDesiredPlayback(false)
      cancelScheduledPlay()
      clearScheduled()
      pendingRevisionRef.current = playState.revision
      const { currentTime, isPlaying, serverTimestamp, revision, serverTimeToExecute } = playState
      const delay = isCalibrated() ? Math.max(0, serverTimeToExecute - getServerTime()) : 0
      const duration = useRoomStore.getState().room?.currentTrack?.duration ??
        usePlayerStore.getState().currentTrack?.duration ?? 0
      const getSeekTime = () => getCompensatedScheduledPosition(currentTime, serverTimeToExecute, duration, howlRef.current)
      const sound = howlRef.current
      const hardwareStart = Boolean(
        isPlaying && delay > 0 && sound?.playScheduled && sound.state() === 'loaded' &&
        !sound.playing() && startPlayback,
      )
      if (hardwareStart) startPlayback?.(getSeekTime, delay)

      scheduledTimer = setTimeout(() => {
        clearScheduled()
        if (isStale(revision)) return
        const target = isPlaying ? getSeekTime() : currentTime
        if (isPlaying) setScheduledPlayback(getSeekTime)
        else {
          clearWaitingLoadState()
          setDesiredPlayback(false, () => currentTime)
        }

        const activeSound = howlRef.current
        if (activeSound && !hardwareStart && (!isPlaying || activeSound.state() === 'loaded')) {
          if (!isPlaying && activeSound.playing()) activeSound.pause(soundIdRef.current)
          if (isPlaying && !activeSound.playing() && activeSound.playScheduled && startPlayback) {
            startPlayback(getSeekTime)
          } else {
            setHowlPosition(activeSound, target, soundIdRef.current)
            if (activeSound.rate() !== 1) activeSound.rate(1)
            if (isPlaying && !activeSound.playing()) {
              soundIdRef.current = activeSound.play(soundIdRef.current)
            }
          }
        }
        usePlayerStore.getState().setCurrentTime(target)
        lyricPlayerBridge.seek(target)
        resetDrift()
        useRoomStore.getState().updateRoom({
          playState: { currentTime, isPlaying, serverTimestamp, revision },
          serverTimeToExecute: undefined,
        })
      }, delay)
    }

    const resetForTrack = (revision: number) => {
      if (isStale(revision)) return
      setDesiredPlayback(false)
      cancelScheduledPlay()
      clearScheduled()
      lastEffectiveLatencyMs = undefined
      rateOverrideCount = 0
      rateDisabled = false
      resetDrift()
    }

    const onPlay: ServerToClientEvents[typeof EVENTS.PLAYER_PLAY] = ({ track, playState }) => {
      const key = `${track?.id}:${playState.revision}:${playState.serverTimestamp}`
      if (isStale(playState.revision) || lastPlayKey === key) return
      lastPlayKey = key
      resetForTrack(playState.revision)
    }

    const onPrepare: ServerToClientEvents[typeof EVENTS.PLAYER_PREPARE] = ({ track, revision }) => {
      const key = `${track.id}:${revision}:prepare`
      if (isStale(revision) || lastPlayKey === key || lastPlayKey?.startsWith(`${track.id}:${revision}:`)) return
      lastPlayKey = key
      resetForTrack(revision)
    }

    const sampleDrift = () => {
      const { room, connectionStatus } = useRoomStore.getState()
      const sound = howlRef.current
      const now = getServerTime()
      if (connectionStatus === 'reconnecting' || !isCalibrated() || !room?.currentTrack || !room.playState.isPlaying || !sound?.playing() ||
          now < room.playState.serverTimestamp) return

      const { currentTime, serverTimestamp, revision } = room.playState
      const key = `${room.currentTrack.id}:${revision}`
      if (anchorKey !== key) {
        resetDrift()
        anchorKey = key
        lastEffectiveLatencyMs = undefined
      }
      if (sound.getOutputLatencyMs) {
        usePlayerStore.getState().setDetectedAudioLatencyMs(getSoundOutputLatencyMs(sound))
      }
      const effectiveLatencyMs = getEffectiveAudioLatencyOffsetMs(sound)
      const expected = compensatePlaybackPosition(
        currentTime + (now - serverTimestamp) / 1000,
        room.currentTrack.duration,
        sound,
      )
      const current = sound.seek()
      if (typeof current !== 'number' || !Number.isFinite(current)) return

      const pitchSafeRate = sound.supportsPitchPreservingRate !== false
      if (lastEffectiveLatencyMs !== undefined && Math.abs(effectiveLatencyMs - lastEffectiveLatencyMs) >= 20) {
        lastEffectiveLatencyMs = effectiveLatencyMs
        if (!pitchSafeRate && sound.crossfadeSeek && Math.abs(current - expected) > 0.02) {
          if (room.currentTrack.duration > 0 && expected >= room.currentTrack.duration) return
          if (sound.rate() !== 1) sound.rate(1)
          sound.crossfadeSeek(expected)
          resetDrift()
          return
        }
        resetDrift()
        return
      }
      lastEffectiveLatencyMs = effectiveLatencyMs

      samples = [...samples.slice(1 - DRIFT_SAMPLE_COUNT), current - expected]
      if (samples.length < DRIFT_SAMPLE_COUNT) return

      const median = medianDrift(samples)
      smoothedDrift = smoothedDrift === undefined
        ? median
        : DRIFT_SMOOTH_ALPHA * median + (1 - DRIFT_SMOOTH_ALPHA) * smoothedDrift
      usePlayerStore.getState().setSyncDrift(smoothedDrift)

      const seekThreshold = (pitchSafeRate
        ? getHardSeekThresholdMs(DRIFT_SEEK_THRESHOLD_MS, getMedianRTT(), DRIFT_SEEK_RTT_MARGIN_MS)
        : WEB_AUDIO_SEEK_THRESHOLD_MS) / 1000
      if (Math.abs(smoothedDrift) > seekThreshold && Math.abs(median) > seekThreshold) {
        if (++hardSeekCount < HARD_SEEK_CONFIRM_COUNT) return
        // Let the current source finish naturally when compensation reaches the end.
        if (room.currentTrack.duration > 0 && expected >= room.currentTrack.duration) return
        if (sound.rate() !== 1) sound.rate(1)
        if (!pitchSafeRate && sound.crossfadeSeek) sound.crossfadeSeek(expected)
        else setHowlPosition(sound, expected, soundIdRef.current)
        resetDrift()
        return
      }

      hardSeekCount = 0
      if (rateDisabled) return
      const limit = pitchSafeRate ? MAX_RATE_ADJUSTMENT : WEB_AUDIO_MAX_RATE_ADJUSTMENT
      const adjustment = Math.abs(smoothedDrift) <= DRIFT_DEAD_ZONE_MS / 1000
        ? 0
        : Math.max(-limit, Math.min(limit, smoothedDrift * DRIFT_RATE_KP))
      const rate = 1 - adjustment
      if (adjustment === 0 ? sound.rate() !== 1 : Math.abs(sound.rate() - rate) > 0.0005) sound.rate(rate)
      if (pitchSafeRate && adjustment !== 0) {
        clearTimeout(rateCheckTimer)
        rateCheckTimer = setTimeout(() => {
          if (howlRef.current !== sound) return
          rateOverrideCount = Math.abs(sound.rate() - rate) > 0.005 ? rateOverrideCount + 1 : 0
          if (rateOverrideCount >= 3) rateDisabled = true
        }, 50)
      }
    }

    const onSyncResponse: ServerToClientEvents[typeof EVENTS.PLAYER_SYNC_RESPONSE] = (data) => {
      const { room } = useRoomStore.getState()
      if (!room?.currentTrack || !isCalibrated() || data.trackId !== room.currentTrack.id ||
          pendingRevisionRef.current !== -1 || data.serverTimestamp <= room.playState.serverTimestamp) return

      const { currentTime, isPlaying, serverTimestamp } = data
      if (room.playState.isPlaying !== isPlaying) {
        scheduleAction({
          playState: {
            ...room.playState,
            currentTime,
            isPlaying,
            serverTimestamp,
            serverTimeToExecute: serverTimestamp,
          },
        })
      } else {
        useRoomStore.getState().updateRoom({ playState: { ...room.playState, currentTime, serverTimestamp } })
        if (isPlaying) {
          const duration = room.currentTrack.duration
          setScheduledPlayback(() => getCompensatedScheduledPosition(currentTime, serverTimestamp, duration, howlRef.current))
        }
      }
    }

    const onDisconnect = () => {
      lastPlayKey = undefined
      anchorKey = undefined
      lastEffectiveLatencyMs = undefined
      clearScheduled()
      clearWaitingLoadState()
      resetDrift()
      const sound = howlRef.current
      if (sound?.playing() && sound.rate() !== 1) sound.rate(1)
    }
    const driftTimer = setInterval(sampleDrift, DRIFT_SAMPLE_INTERVAL_MS)
    const syncTimer = setInterval(() => {
      if (useRoomStore.getState().room && canSendRoomCommand(socket)) socket.emit(EVENTS.PLAYER_SYNC_REQUEST)
    }, SYNC_REQUEST_INTERVAL_MS)

    socket.on(EVENTS.PLAYER_SEEK, scheduleAction)
    socket.on(EVENTS.PLAYER_PAUSE, scheduleAction)
    socket.on(EVENTS.PLAYER_RESUME, scheduleAction)
    socket.on(EVENTS.PLAYER_PLAY, onPlay)
    socket.on(EVENTS.PLAYER_PREPARE, onPrepare)
    socket.on(EVENTS.PLAYER_SYNC_RESPONSE, onSyncResponse)
    socket.on('disconnect', onDisconnect)

    return () => {
      clearInterval(driftTimer)
      clearInterval(syncTimer)
      clearScheduled()
      clearTimeout(rateCheckTimer)
      socket.off(EVENTS.PLAYER_SEEK, scheduleAction)
      socket.off(EVENTS.PLAYER_PAUSE, scheduleAction)
      socket.off(EVENTS.PLAYER_RESUME, scheduleAction)
      socket.off(EVENTS.PLAYER_PLAY, onPlay)
      socket.off(EVENTS.PLAYER_PREPARE, onPrepare)
      socket.off(EVENTS.PLAYER_SYNC_RESPONSE, onSyncResponse)
      socket.off('disconnect', onDisconnect)
    }
  }, [socket, howlRef, soundIdRef, setDesiredPlayback, setScheduledPlayback, startPlayback])

  return pendingRevisionRef
}
