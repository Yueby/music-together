import { getServerTime, isCalibrated } from '@/lib/clockSync'
import { PLAYER_PLAY_DEDUP_MS } from '@/lib/constants'
import { lyricPlayerBridge } from '@/lib/lyricPlayerBridge'
import { playbackSoundFactory } from '@/lib/playbackSoundFactory'
import { getScheduledPlaybackPosition, getScheduledServerNow } from '@/lib/playbackSync'
import { registerPendingPlayCancel } from '@/lib/scheduledPlayback'
import { useSocketContext } from '@/providers/SocketProvider'
import { usePlayerStore } from '@/stores/playerStore'
import { useRoomStore } from '@/stores/roomStore'
import type { ScheduledPlayState, Track } from '@music-together/shared'
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
    revision: number
    ts: number
    serverTimestamp: number
  } | null>(null)
  // Set by recovery effect to signal onPlayerPlay that this track was already
  // loaded by reconnect recovery — the subsequent PLAYER_PLAY from
  // syncPlaybackToSocket should be skipped to avoid a double-load.
  const recoveredTrackIdRef = useRef<{ trackId: string; autoPlay: boolean } | null>(null)

  const next = useCallback(() => socket.emit(EVENTS.PLAYER_NEXT), [socket])

  // Auto-next on song end: only the current conductor (hostId) emits PLAYER_NEXT.
  // The conductor is auto-elected by the server (owner > admin > member).
  // Other clients silently wait to prevent duplicate PLAYER_NEXT events.
  const autoNext = useCallback(() => {
    const { room } = useRoomStore.getState()
    if (room?.conductorSocketId === socket.id) socket.emit(EVENTS.PLAYER_NEXT)
  }, [socket])

  const { howlRef, soundIdRef, loadTrack, setDesiredPlayback, setScheduledPlayback, startPlayback } = useHowl(autoNext)
  const { fetchLyric } = useLyric()

  // Connect sync (handles SEEK, PAUSE, RESUME + conductor reporting)
  usePlayerSync(howlRef, soundIdRef, setDesiredPlayback, setScheduledPlayback)

  // Reset dedup ref on disconnect so reconnect PLAYER_PLAY is never blocked
  useEffect(() => {
    const onDisconnect = () => {
      loadingRef.current = null
      recoveredTrackIdRef.current = null
    }
    socket.on('disconnect', onDisconnect)
    return () => {
      socket.off('disconnect', onDisconnect)
    }
  }, [socket])

  // Listen for PLAYER_PLAY events (new track load)
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    const onPlayerPlay = (data: { track: Track; playState: ScheduledPlayState }) => {
      const currentRevision = useRoomStore.getState().room?.playState.revision ?? -1
      if (data.playState.revision < currentRevision) return
      // Deduplicate: ignore if the same track with the same serverTimestamp
      // was requested within the dedup window.  Comparing serverTimestamp
      // ensures that a legitimate replay of the same track (e.g. loop mode)
      // with a different serverTimestamp is not discarded.
      const now = Date.now()
      if (
        loadingRef.current?.trackId === data.track.id &&
        loadingRef.current.revision === data.playState.revision &&
        loadingRef.current.serverTimestamp === data.playState.serverTimestamp
      ) {
        // Keep the same action idempotent while its Howl still exists. The
        // short window remains only as protection during synchronous setup.
        if (howlRef.current || now - loadingRef.current.ts < PLAYER_PLAY_DEDUP_MS) return
      }
      // Recovery already loaded this track (reconnect: ROOM_STATE → recovery
      // loadTrack → PLAYER_PLAY from syncPlaybackToSocket).  The serverTimestamp
      // differs (syncPlaybackToSocket computes a new scheduleTime) so the normal
      // dedup above doesn't catch it.  Skip the redundant load but update
      // roomStore with the authoritative scheduled playState.
      if (recoveredTrackIdRef.current?.trackId === data.track.id) {
        recoveredTrackIdRef.current = null
        loadingRef.current = {
          trackId: data.track.id,
          revision: data.playState.revision,
          ts: now,
          serverTimestamp: data.playState.serverTimestamp,
        }
        useRoomStore.getState().updateRoom({
          currentTrack: data.track,
          playState: {
            isPlaying: data.playState.isPlaying,
            currentTime: data.playState.currentTime,
            serverTimestamp: data.playState.serverTimestamp,
            revision: data.playState.revision,
          },
        })
        // Recovery may have preloaded this track paused. Apply the authoritative
        // scheduled transition instead of discarding it solely by track ID.
        const delay = isCalibrated()
          ? Math.max(0, data.playState.serverTimeToExecute - getServerTime())
          : 0
        if (playTimerRef.current) clearTimeout(playTimerRef.current)
        playTimerRef.current = setTimeout(() => {
          playTimerRef.current = null
          if (data.playState.isPlaying) {
            startPlayback(() => {
              return getScheduledPlaybackPosition(
                data.playState.currentTime,
                data.playState.serverTimeToExecute,
                getScheduledServerNow(data.playState.serverTimeToExecute),
              )
            })
          } else if (howlRef.current?.playing()) {
            setDesiredPlayback(false)
            howlRef.current.pause(soundIdRef.current)
          }
        }, delay)
        return
      }
      loadingRef.current = {
        trackId: data.track.id,
        revision: data.playState.revision,
        ts: now,
        serverTimestamp: data.playState.serverTimestamp,
      }

      // Keep roomStore in sync so recovery effect sees the correct currentTrack
      useRoomStore.getState().updateRoom({
        currentTrack: data.track,
        playState: {
          isPlaying: data.playState.isPlaying,
          currentTime: data.playState.currentTime,
          serverTimestamp: data.playState.serverTimestamp,
          revision: data.playState.revision,
        },
      })

      const ct = data.playState.currentTime
      const executeDelay = isCalibrated()
        ? Math.max(0, data.playState.serverTimeToExecute - getServerTime())
        : 0

      if (data.playState.isPlaying && data.playState.serverTimeToExecute) {
        // Start loading immediately so slower mobile decoders are ready before
        // the shared execution time. If loading finishes late, begin at the
        // elapsed authoritative position instead of starting behind at `ct`.
        loadTrack(data.track, ct, false)
        fetchLyric(data.track)
        if (playTimerRef.current) clearTimeout(playTimerRef.current)
        playTimerRef.current = setTimeout(() => {
          playTimerRef.current = null
          startPlayback(() => {
            return getScheduledPlaybackPosition(
              ct,
              data.playState.serverTimeToExecute,
              getScheduledServerNow(data.playState.serverTimeToExecute),
            )
          })
        }, executeDelay)
      } else {
        // Paused track or legacy payload without a scheduled execution time.
        const elapsed = data.playState.isPlaying
          ? Math.max(0, (getServerTime() - data.playState.serverTimestamp) / 1000)
          : 0
        const adjustedTime = ct + elapsed

        loadTrack(data.track, adjustedTime, data.playState.isPlaying)
        fetchLyric(data.track)
      }
    }

    socket.on(EVENTS.PLAYER_PLAY, onPlayerPlay)

    return () => {
      socket.off(EVENTS.PLAYER_PLAY, onPlayerPlay)
      if (playTimerRef.current) {
        clearTimeout(playTimerRef.current)
        playTimerRef.current = null
      }
    }
  }, [socket, loadTrack, fetchLyric, howlRef, soundIdRef, setDesiredPlayback, startPlayback])

  // The server announces the track that will probably follow, so a host that must download a whole file first
  // can have it ready before the transition instead of starting seconds into it.
  useEffect(() => {
    const onPreload = (data: { track: Track }) => {
      try {
        playbackSoundFactory.preload?.(data.track)
      } catch {
        // Preloading is an optimisation; it must never disturb playback.
      }
    }
    socket.on(EVENTS.PLAYER_PRELOAD, onPreload)
    return () => {
      socket.off(EVENTS.PLAYER_PRELOAD, onPreload)
    }
  }, [socket])

  // Recovery: auto-sync player state from room state when desync is detected
  // (e.g. after HMR resets stores, or PLAYER_PLAY arrived before this route's
  // listener mounted). Defer the initial check one macrotask so a PLAYER_PLAY
  // already queued behind ROOM_STATE gets a chance to run first.
  useEffect(() => {
    let recoveredKey: string | null = null

    const recover = () => {
      const { room } = useRoomStore.getState()

      // When room becomes null (disconnect), reset recovery generation.
      if (!room) {
        recoveredKey = null
        return
      }

      const playerTrack = usePlayerStore.getState().currentTrack
      const roomTrack = room.currentTrack
      const recoveryKey = roomTrack ? `${roomTrack.id}:${room.playState.revision}` : `empty:${room.playState.revision}`

      // Server has cleared the track (queue empty / cleared) — reset client
      if (!roomTrack && playerTrack) {
        if (recoveredKey === recoveryKey) return
        recoveredKey = recoveryKey
        if (howlRef.current) {
          try {
            howlRef.current.unload()
          } catch {
            /* ignore */
          }
          howlRef.current = null
        }
        soundIdRef.current = undefined
        usePlayerStore.getState().reset()
        return
      }

      // Server has track but client doesn't (HMR reset / missed PLAYER_PLAY)
      if (roomTrack?.streamUrl && (!playerTrack || !howlRef.current)) {
        // Skip if onPlayerPlay is already handling this track — its updateRoom()
        // call triggers this subscription synchronously before loadTrack runs,
        // so playerTrack/howlRef are still stale. Checking loadingRef avoids
        // a redundant double-load.
        // loadingRef is set before updateRoom(), so this subscription can run
        // synchronously before loadTrack() creates the Howl. Never start a
        // second load for an event that is already being handled.
        if (
          loadingRef.current?.trackId === roomTrack.id &&
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
        const scheduledExecution = room.serverTimeToExecute
        const isFuturePlayback =
          ps.isPlaying && scheduledExecution !== undefined && scheduledExecution > getServerTime()
        const elapsed = ps.isPlaying && !isFuturePlayback ? (getServerTime() - ps.serverTimestamp) / 1000 : 0
        const autoPlay = ps.isPlaying && !isFuturePlayback
        recoveredTrackIdRef.current = { trackId: roomTrack.id, autoPlay }
        loadTrack(roomTrack, ps.currentTime + Math.max(0, elapsed), autoPlay)
        fetchLyric(roomTrack)

        if (ps.isPlaying && scheduledExecution !== undefined) {
          const delay = isCalibrated() ? Math.max(0, scheduledExecution - getServerTime()) : 0
          playTimerRef.current = setTimeout(() => {
            playTimerRef.current = null
            startPlayback(() =>
              getScheduledPlaybackPosition(
                ps.currentTime,
                scheduledExecution,
                getScheduledServerNow(scheduledExecution),
              ),
            )
          }, delay)
        }
      }
    }

    const initialRecoveryTimer = setTimeout(recover, 0)

    // Subscribe for future changes (covers reconnect where ROOM_STATE arrives later)
    const unsubscribe = useRoomStore.subscribe(recover)
    return () => {
      clearTimeout(initialRecoveryTimer)
      unsubscribe()
    }
    // `socket` intentionally excluded — effect subscribes to roomStore, not socket directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadTrack, fetchLyric])

  // -----------------------------------------------------------------------
  // Controls — emit to server only.  Server broadcasts ScheduledPlayState
  // to ALL clients (including us) via scheduled execution.
  // -----------------------------------------------------------------------
  const play = useCallback(() => {
    socket.emit(EVENTS.PLAYER_PLAY)
  }, [socket])

  const pause = useCallback(() => {
    socket.emit(EVENTS.PLAYER_PAUSE)
  }, [socket])

  const seek = useCallback(
    (time: number) => {
      // Optimistic local update for the progress bar UI
      usePlayerStore.getState().setCurrentTime(time)
      lyricPlayerBridge.seek(time)
      socket.emit(EVENTS.PLAYER_SEEK, { currentTime: time })
    },
    [socket],
  )

  const prev = useCallback(() => socket.emit(EVENTS.PLAYER_PREV), [socket])

  // MediaSession: hardware media keys + OS media notification bar.
  // Permission-aware: mirrors PlayerControls fallback-to-vote behaviour.
  useMediaSession({ play, pause, next, prev, seek })

  return { play, pause, seek, next, prev }
}
