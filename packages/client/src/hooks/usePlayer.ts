import { getServerTime } from '@/lib/clockSync'
import { PLAYER_PLAY_DEDUP_MS } from '@/lib/constants'
import { useSocketContext } from '@/providers/SocketProvider'
import { usePlayerStore } from '@/stores/playerStore'
import { useRoomStore } from '@/stores/roomStore'
import type { ScheduledPlayState, Track } from '@music-together/shared'
import { EVENTS } from '@music-together/shared'
import { useCallback, useEffect, useRef } from 'react'
import { useHowl } from './useHowl'
import { useLyric } from './useLyric'
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
  const loadingRef = useRef<{ trackId: string; ts: number } | null>(null)

  const next = useCallback(() => socket.emit(EVENTS.PLAYER_NEXT), [socket])

  // Auto-next on song end: only host/admin emit PLAYER_NEXT.
  // Members silently wait — the host's client will advance the queue.
  const autoNext = useCallback(() => {
    const role = useRoomStore.getState().currentUser?.role
    if (role === 'host' || role === 'admin') {
      socket.emit(EVENTS.PLAYER_NEXT)
    }
  }, [socket])

  const { howlRef, soundIdRef, loadTrack } = useHowl(autoNext)
  const { fetchLyric } = useLyric()

  // Connect sync (handles SEEK, PAUSE, RESUME + host reporting)
  usePlayerSync(howlRef, soundIdRef)

  // Reset dedup ref on disconnect so reconnect PLAYER_PLAY is never blocked
  useEffect(() => {
    const onDisconnect = () => {
      loadingRef.current = null
    }
    socket.on('disconnect', onDisconnect)
    return () => { socket.off('disconnect', onDisconnect) }
  }, [socket])

  // Listen for PLAYER_PLAY events (new track load)
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const onPlayerPlay = (data: { track: Track; playState: ScheduledPlayState }) => {
      // Deduplicate: ignore if the same track was requested within the dedup window
      const now = Date.now()
      if (
        loadingRef.current?.trackId === data.track.id &&
        now - loadingRef.current.ts < PLAYER_PLAY_DEDUP_MS
      ) {
        return
      }
      loadingRef.current = { trackId: data.track.id, ts: now }

      // Keep roomStore in sync so recovery effect sees the correct currentTrack
      useRoomStore.getState().updateRoom({
        currentTrack: data.track,
        playState: {
          isPlaying: data.playState.isPlaying,
          currentTime: data.playState.currentTime,
          serverTimestamp: data.playState.serverTimestamp,
        },
      })

      const ct = data.playState.currentTime

      if (ct === 0 && data.playState.serverTimeToExecute) {
        // New track from position 0: schedule load so playback begins at
        // the coordinated server-time.  We load with autoPlay=true and let
        // the scheduling delay account for buffering.
        const delay = Math.max(0, data.playState.serverTimeToExecute - getServerTime())
        if (playTimerRef.current) clearTimeout(playTimerRef.current)
        playTimerRef.current = setTimeout(() => {
          playTimerRef.current = null
          loadTrack(data.track, 0, data.playState.isPlaying)
          fetchLyric(data.track)
        }, delay)
      } else {
        // Mid-song join or currentTime > 0: load immediately and seek to
        // the expected position at the scheduled execution time.
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
  }, [socket, loadTrack, fetchLyric])

  // Recovery: auto-sync player state from room state when desync is detected
  // (e.g. after HMR resets stores, or reconnection where PLAYER_PLAY was missed)
  useEffect(() => {
    let hasRecovered = false

    const recover = () => {
      const { room } = useRoomStore.getState()

      // When room becomes null (disconnect), reset flag so next reconnect can recover
      if (!room) {
        hasRecovered = false
        return
      }

      if (hasRecovered) return
      const playerTrack = usePlayerStore.getState().currentTrack
      const roomTrack = room.currentTrack

      // Server has cleared the track (queue empty / cleared) — reset client
      if (!roomTrack && playerTrack) {
        hasRecovered = true
        if (howlRef.current) {
          try { howlRef.current.unload() } catch { /* ignore */ }
          howlRef.current = null
        }
        soundIdRef.current = undefined
        usePlayerStore.getState().reset()
        return
      }

      // Server has track but client doesn't (HMR reset / missed PLAYER_PLAY)
      if (roomTrack?.streamUrl && (!playerTrack || !howlRef.current)) {
        hasRecovered = true
        const ps = room.playState
        const elapsed = ps.isPlaying
          ? (getServerTime() - ps.serverTimestamp) / 1000
          : 0
        loadTrack(roomTrack, ps.currentTime + Math.max(0, elapsed), ps.isPlaying)
        fetchLyric(roomTrack)
      }
    }

    // Check immediately (covers HMR where roomStore already has data)
    recover()

    // Subscribe for future changes (covers reconnect where ROOM_STATE arrives later)
    const unsubscribe = useRoomStore.subscribe(recover)
    return unsubscribe
  }, [loadTrack, fetchLyric, socket])

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
      socket.emit(EVENTS.PLAYER_SEEK, { currentTime: time })
    },
    [socket],
  )

  const prev = useCallback(() => socket.emit(EVENTS.PLAYER_PREV), [socket])

  return { play, pause, seek, next, prev }
}
