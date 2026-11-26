import { getServerTime, isCalibrated } from '@/lib/clockSync'
import { PLAYER_PLAY_DEDUP_MS } from '@/lib/constants'
import { lyricPlayerBridge } from '@/lib/lyricPlayerBridge'
import { setHowlPosition } from '@/lib/howlPosition'
import { getCompensatedScheduledPosition } from '@/lib/playbackSync'
import { cancelScheduledPlay, registerPendingPlayCancel } from '@/lib/scheduledPlayback'
import { useSocketContext } from '@/providers/SocketProvider'
import { usePlayerStore } from '@/stores/playerStore'
import { canSendRoomCommand, useRoomStore } from '@/stores/roomStore'
import type { ServerToClientEvents, Track } from '@music-together/shared'
import { EVENTS } from '@music-together/shared'
import { useCallback, useEffect, useRef } from 'react'
import { useHowl } from './useHowl'
import { useLyric } from './useLyric'
import { useMediaSession } from './useMediaSession'
import { usePlayerSync } from './usePlayerSync'

/**
 * Composing hook: useHowl + useLyric + usePlayerSync.
 * Provides unified playback controls.
 *
 * Architecture: **Scheduled Execution**.
 * All player actions (play, pause, seek, resume) are emitted to the server
 * which broadcasts a `ScheduledPlayState` to ALL clients (including the
 * initiator). Clients then execute the action at the scheduled server-time
 * so that every device acts in unison.
 */
export function usePlayer() {
  const { socket } = useSocketContext()
  const loadingRef = useRef<{
    trackId: string
    streamUrl: Track['streamUrl']
    revision: number
    ts: number
    serverTimestamp: number
  } | null>(null)
  // Set by recovery effect to signal onPlayerPlay that this track was already
  // loaded by reconnect recovery — the subsequent PLAYER_PLAY from
  // syncPlaybackToSocket should be skipped to avoid a double-load.
  const recoveredTrackRef = useRef<Track | null>(null)
  const preparedRef = useRef<{ track: Track; revision: number; ready: boolean; started: boolean; startedAt: number } | null>(null)

  const next = useCallback(() => {
    if (canSendRoomCommand(socket)) socket.emit(EVENTS.PLAYER_NEXT)
  }, [socket])

  // The server arbitrates concurrent completion reports by track and revision.
  const autoNext = useCallback(() => {
    if (!canSendRoomCommand(socket)) return
    const { room } = useRoomStore.getState()
    const trackId = usePlayerStore.getState().currentTrack?.id
    if (!room?.playState.isPlaying || !trackId || trackId !== room.currentTrack?.id) return
    socket.emit(EVENTS.PLAYER_NEXT, {
      auto: true,
      trackId,
      revision: room.playState.revision,
    })
  }, [socket])

  const {
    howlRef, soundIdRef, loadTrack, reuseTrackLoad, preloadTrack, setDesiredPlayback, setScheduledPlayback, startPlayback,
    stopAndUnload,
  } = useHowl(autoNext)
  const { fetchLyric } = useLyric()

  const pendingRevisionRef = usePlayerSync(howlRef, soundIdRef, setDesiredPlayback, setScheduledPlayback, startPlayback)

  // Reset dedup ref on disconnect so reconnect PLAYER_PLAY is never blocked
  useEffect(() => {
    const onDisconnect = () => {
      loadingRef.current = null
      recoveredTrackRef.current = null
      preparedRef.current = null
      cancelScheduledPlay()
      setDesiredPlayback(false)
      if (usePlayerStore.getState().audioLoadPhase === 'waiting') {
        usePlayerStore.getState().setAudioLoadState({ phase: 'idle' })
      }
    }
    socket.on('disconnect', onDisconnect)
    return () => {
      socket.off('disconnect', onDisconnect)
    }
  }, [socket, setDesiredPlayback])

  // Listen for PLAYER_PLAY events (new track load)
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleStart = useCallback((getSeekTime: () => number, executionTime: number) => {
    cancelScheduledPlay()
    const delay = isCalibrated() ? Math.max(0, executionTime - getServerTime()) : 0
    const sound = howlRef.current
    if (delay > 0 && sound?.playScheduled && sound.state() === 'loaded') {
      startPlayback(getSeekTime, delay)
      return
    }
    playTimerRef.current = setTimeout(() => {
      playTimerRef.current = null
      startPlayback(getSeekTime)
    }, delay)
  }, [howlRef, startPlayback])

  useEffect(() => {
    const unregister = registerPendingPlayCancel(() => {
      if (playTimerRef.current) {
        clearTimeout(playTimerRef.current)
        playTimerRef.current = null
      }
    })
    return unregister
  }, [])

  useEffect(() => {
    const sameSound = (previous: Track | undefined | null, track: Track) =>
      previous?.id === track.id && previous.streamUrl === track.streamUrl &&
      howlRef.current !== null && howlRef.current.state() !== 'unloaded'

    const onPrepare: ServerToClientEvents[typeof EVENTS.PLAYER_PREPARE] = ({ track, revision }) => {
      const currentRevision = useRoomStore.getState().room?.playState.revision ?? -1
      if (revision < Math.max(currentRevision, pendingRevisionRef.current) ||
          revision <= (loadingRef.current?.revision ?? -1) ||
          revision <= (preparedRef.current?.revision ?? -1)) return

      const prepare = { track, revision, ready: false, started: false, startedAt: Date.now() }
      preparedRef.current = prepare
      recoveredTrackRef.current = null
      cancelScheduledPlay()
      useRoomStore.getState().updateRoom({
        currentTrack: track,
        playState: { isPlaying: false, currentTime: 0, serverTimestamp: getServerTime(), revision },
        serverTimeToExecute: undefined,
      })
      const onLoadSettled = (failed: boolean) => {
        if (preparedRef.current !== prepare || prepare.ready || !canSendRoomCommand(socket)) return
        prepare.ready = true
        if (!failed && !prepare.started) {
          usePlayerStore.getState().setAudioLoadState({
            phase: 'waiting',
            progress: null,
            loadedBytes: null,
            startedAt: prepare.startedAt,
          })
        }
        socket.emit(EVENTS.PLAYER_READY, failed ? { trackId: track.id, revision, failed } : { trackId: track.id, revision })
      }
      if (!reuseTrackLoad(track, onLoadSettled)) {
        loadTrack(track, 0, false, onLoadSettled)
        fetchLyric(track)
      }
    }

    const onPlayerPlay: ServerToClientEvents[typeof EVENTS.PLAYER_PLAY] = ({ track, playState }) => {
      const currentRevision = useRoomStore.getState().room?.playState.revision ?? -1
      if (playState.revision < Math.max(currentRevision, pendingRevisionRef.current, preparedRef.current?.revision ?? -1)) return
      const now = Date.now()
      if (loadingRef.current?.trackId === track.id &&
          loadingRef.current.streamUrl === track.streamUrl &&
          loadingRef.current.revision === playState.revision &&
          loadingRef.current.serverTimestamp === playState.serverTimestamp &&
          (howlRef.current || now - loadingRef.current.ts < PLAYER_PLAY_DEDUP_MS)) return

      const prepare = preparedRef.current
      const reusePrepared = prepare && !prepare.started && sameSound(prepare.track, track)
      const reuseRecovered = sameSound(recoveredTrackRef.current, track)
      const reuse = reusePrepared || reuseRecovered
      recoveredTrackRef.current = null
      // Keep the ready callback alive if this announcement starts the prepared sound.
      if (reusePrepared) prepare.started = true
      else preparedRef.current = null

      loadingRef.current = {
        trackId: track.id,
        streamUrl: track.streamUrl,
        revision: playState.revision,
        ts: now,
        serverTimestamp: playState.serverTimestamp,
      }
      const { currentTime, isPlaying, serverTimestamp, revision, serverTimeToExecute } = playState
      useRoomStore.getState().updateRoom({
        currentTrack: track,
        playState: { currentTime, isPlaying, serverTimestamp, revision },
        serverTimeToExecute,
      })

      if (!reuse) {
        loadTrack(track, currentTime, false)
        fetchLyric(track)
      }
      if (isPlaying) {
        const executionTime = serverTimeToExecute || serverTimestamp
        const getSeekTime = () => getCompensatedScheduledPosition(currentTime, executionTime, track.duration, howlRef.current)
        if (reuseRecovered && howlRef.current?.playing()) {
          if (usePlayerStore.getState().audioLoadPhase === 'waiting') {
            usePlayerStore.getState().setAudioLoadState({ phase: 'idle' })
          }
          setScheduledPlayback(getSeekTime)
        } else {
          scheduleStart(getSeekTime, executionTime)
        }
      } else {
        if (usePlayerStore.getState().audioLoadPhase === 'waiting') {
          usePlayerStore.getState().setAudioLoadState({ phase: 'idle' })
        }
        setDesiredPlayback(false, () => currentTime)
        const sound = howlRef.current
        if (sound?.playing()) sound.pause(soundIdRef.current)
        if (reuseRecovered && sound?.state() === 'loaded') {
          setHowlPosition(sound, currentTime, soundIdRef.current)
          usePlayerStore.getState().setCurrentTime(currentTime)
        }
      }
    }

    const onPreload: ServerToClientEvents[typeof EVENTS.PLAYER_PRELOAD] = ({ track }) => {
      try {
        preloadTrack(track)
      } catch {
        // Preloading is best effort.
      }
    }

    socket.on(EVENTS.PLAYER_PREPARE, onPrepare)
    socket.on(EVENTS.PLAYER_PLAY, onPlayerPlay)
    socket.on(EVENTS.PLAYER_PRELOAD, onPreload)
    return () => {
      socket.off(EVENTS.PLAYER_PREPARE, onPrepare)
      socket.off(EVENTS.PLAYER_PLAY, onPlayerPlay)
      socket.off(EVENTS.PLAYER_PRELOAD, onPreload)
      clearTimeout(playTimerRef.current ?? undefined)
      playTimerRef.current = null
    }
  }, [socket, loadTrack, reuseTrackLoad, preloadTrack, fetchLyric, howlRef, soundIdRef, pendingRevisionRef, setDesiredPlayback, setScheduledPlayback, scheduleStart])

  // Recovery: auto-sync player state from room state when desync is detected
  // (e.g. after HMR resets stores, or PLAYER_PLAY arrived before this route's
  // listener mounted). Defer the initial check one macrotask so a PLAYER_PLAY
  // already queued behind ROOM_STATE gets a chance to run first.
  useEffect(() => {
    let recoveredKey: string | null = null

    const recover = (rejoined = false) => {
      const { room, connectionStatus } = useRoomStore.getState()

      // When the room is left, reset the recovery generation.
      if (!room) {
        recoveredKey = null
        return
      }
      if (connectionStatus === 'reconnecting') {
        recoveredKey = null
        return
      }

      const playerTrack = usePlayerStore.getState().currentTrack
      const roomTrack = room.currentTrack
      const recoveryKey = roomTrack
        ? `${roomTrack.id}:${roomTrack.streamUrl ?? ''}:${room.playState.revision}`
        : `empty:${room.playState.revision}`
      const prepare = preparedRef.current
      if (prepare && room.playState.revision <= prepare.revision) return

      const sound = howlRef.current
      if (rejoined && roomTrack && roomTrack.id === playerTrack?.id &&
          roomTrack.streamUrl === playerTrack.streamUrl && sound && sound.state() !== 'unloaded') {
        recoveredTrackRef.current = roomTrack
        const ps = room.playState
        const executionTime = room.serverTimeToExecute ?? ps.serverTimestamp
        if (ps.isPlaying) {
          const getSeekTime = () => getCompensatedScheduledPosition(ps.currentTime, executionTime, roomTrack.duration, sound)
          if (sound.playing()) setScheduledPlayback(getSeekTime)
          else scheduleStart(getSeekTime, executionTime)
        } else {
          setDesiredPlayback(false, () => ps.currentTime)
          if (sound.playing()) sound.pause(soundIdRef.current)
          if (sound.state() === 'loaded') {
            setHowlPosition(sound, ps.currentTime, soundIdRef.current)
            usePlayerStore.getState().setCurrentTime(ps.currentTime)
          }
        }
        return
      }

      // Server has cleared the track (queue empty / cleared) — reset client
      if (!roomTrack && playerTrack) {
        if (recoveredKey === recoveryKey) return
        recoveredKey = recoveryKey
        cancelScheduledPlay()
        stopAndUnload()
        usePlayerStore.getState().reset()
        return
      }

      // Server has track but client doesn't (HMR reset / missed PLAYER_PLAY)
      if (roomTrack?.streamUrl &&
          (roomTrack.id !== playerTrack?.id || roomTrack.streamUrl !== playerTrack.streamUrl || !howlRef.current)) {
        // Skip if onPlayerPlay is already handling this track — its updateRoom()
        // call triggers this subscription synchronously before loadTrack runs,
        // so playerTrack/howlRef are still stale. Checking loadingRef avoids
        // a redundant double-load.
        // loadingRef is set before updateRoom(), so this subscription can run
        // synchronously before loadTrack() creates the Howl. Never start a
        // second load for an event that is already being handled.
        if (
          loadingRef.current?.trackId === roomTrack.id &&
            loadingRef.current.streamUrl === roomTrack.streamUrl &&
          loadingRef.current.revision === room.playState.revision
        ) {
          return
        }
        if (recoveredKey === recoveryKey) return

        recoveredKey = recoveryKey
        // Cancel any pending scheduled load from onPlayerPlay to prevent
        // a second loadTrack call when the timer fires after recovery.
        if (playTimerRef.current) {
          clearTimeout(playTimerRef.current)
          playTimerRef.current = null
        }
        const ps = room.playState
        const scheduledExecution = room.serverTimeToExecute ?? ps.serverTimestamp
        recoveredTrackRef.current = roomTrack
        loadTrack(roomTrack, ps.currentTime, false)
        fetchLyric(roomTrack)

        if (ps.isPlaying) {
          scheduleStart(
            () => getCompensatedScheduledPosition(ps.currentTime, scheduledExecution, roomTrack.duration, howlRef.current),
            scheduledExecution,
          )
        }
      }
    }

    const initialRecoveryTimer = setTimeout(recover, 0)

    // Subscribe for future changes (covers reconnect where ROOM_STATE arrives later)
    const unsubscribe = useRoomStore.subscribe((state, previous) => {
      recover(state.connectionStatus === 'connected' && previous.connectionStatus === 'reconnecting')
    })
    return () => {
      clearTimeout(initialRecoveryTimer)
      unsubscribe()
    }
  }, [loadTrack, fetchLyric, howlRef, soundIdRef, setDesiredPlayback, setScheduledPlayback, scheduleStart, stopAndUnload])

  // -----------------------------------------------------------------------
  // Controls — emit to server only.  Server broadcasts ScheduledPlayState
  // to ALL clients (including us) via scheduled execution.
  // -----------------------------------------------------------------------
  const play = useCallback(() => {
    if (canSendRoomCommand(socket)) socket.emit(EVENTS.PLAYER_PLAY)
  }, [socket])

  const pause = useCallback(() => {
    if (canSendRoomCommand(socket)) socket.emit(EVENTS.PLAYER_PAUSE)
  }, [socket])

  const seek = useCallback(
    (time: number) => {
      if (!canSendRoomCommand(socket)) return
      // Optimistic local update for the progress bar UI
      usePlayerStore.getState().setCurrentTime(time)
      lyricPlayerBridge.seek(time)
      socket.emit(EVENTS.PLAYER_SEEK, { currentTime: time })
    },
    [socket],
  )

  const prev = useCallback(() => {
    if (canSendRoomCommand(socket)) socket.emit(EVENTS.PLAYER_PREV)
  }, [socket])

  // MediaSession: hardware media keys + OS media notification bar.
  // Permission-aware: mirrors PlayerControls fallback-to-vote behaviour.
  useMediaSession({ play, pause, next, prev, seek })

  return { play, pause, seek, next, prev }
}
