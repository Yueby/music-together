import { useCallback, useEffect, useRef } from 'react'
import { EVENTS } from '@music-together/shared'
import { useSocketContext } from '@/providers/SocketProvider'
import { PLAYER_PLAY_DEDUP_MS } from '@/lib/constants'
import { usePlayerStore } from '@/stores/playerStore'
import { useRoomStore } from '@/stores/roomStore'
import { useHowl } from './useHowl'
import { useLyric } from './useLyric'
import { usePlayerSync } from './usePlayerSync'

/**
 * Composing hook: useHowl + useLyric + usePlayerSync.
 * Provides unified playback controls.
 */
export function usePlayer() {
  const { socket } = useSocketContext()
  const loadingRef = useRef<{ trackId: string; ts: number } | null>(null)

  const next = useCallback(() => socket.emit(EVENTS.PLAYER_NEXT), [socket])
  const { howlRef, syncReadyRef, loadTrack } = useHowl(next)
  const { fetchLyric } = useLyric()

  // Connect sync
  usePlayerSync(howlRef, syncReadyRef)

  // Listen for PLAYER_PLAY events
  useEffect(() => {
    socket.on(EVENTS.PLAYER_PLAY, (data) => {
      // Deduplicate: ignore if the same track was requested within the dedup window
      const now = Date.now()
      if (
        loadingRef.current?.trackId === data.track.id &&
        now - loadingRef.current.ts < PLAYER_PLAY_DEDUP_MS
      ) {
        return
      }
      loadingRef.current = { trackId: data.track.id, ts: now }

      // Compensate for network delay, but ONLY for mid-song joins (currentTime > 0).
      // New songs (currentTime === 0) must skip compensation to avoid triggering
      // useHowl's slow seek path (1200ms mute) instead of the fast start path (100ms).
      const ct = data.playState.currentTime
      let adjustedTime = ct
      if (ct > 0 && data.playState.isPlaying) {
        const rawDelay = (Date.now() - data.playState.serverTimestamp) / 1000
        adjustedTime = ct + Math.max(0, Math.min(5, rawDelay))
      }

      loadTrack(data.track, adjustedTime, data.playState.isPlaying)
      fetchLyric(data.track)
    })

    return () => {
      socket.off(EVENTS.PLAYER_PLAY)
    }
  }, [socket, loadTrack, fetchLyric])

  // Recovery: auto-sync player state from room state when desync is detected
  // (e.g. after HMR resets stores, or reconnection where PLAYER_PLAY was missed)
  useEffect(() => {
    let hasRecovered = false

    const recover = () => {
      if (hasRecovered) return
      const { room } = useRoomStore.getState()
      if (!room) return
      const playerTrack = usePlayerStore.getState().currentTrack
      const roomTrack = room.currentTrack

      // Case 1: Server has track but client doesn't (HMR reset / missed PLAYER_PLAY)
      if (roomTrack?.streamUrl && !playerTrack) {
        hasRecovered = true
        const ps = room.playState
        const elapsed = ps.isPlaying
          ? (Date.now() - ps.serverTimestamp) / 1000
          : 0
        loadTrack(roomTrack, ps.currentTime + elapsed, ps.isPlaying)
        fetchLyric(roomTrack)
        return
      }

      // Case 2: No track anywhere but queue has items → ask server to play from queue
      if (!roomTrack && !playerTrack && room.queue.length > 0) {
        hasRecovered = true
        socket.emit(EVENTS.PLAYER_PLAY)
      }
    }

    // Check immediately (covers HMR where roomStore already has data)
    recover()

    // Subscribe for future changes (covers reconnect where ROOM_STATE arrives later)
    const unsubscribe = useRoomStore.subscribe(recover)
    return unsubscribe
  }, [loadTrack, fetchLyric, socket])

  // Exposed controls
  const play = useCallback(() => socket.emit(EVENTS.PLAYER_PLAY), [socket])
  const pause = useCallback(() => socket.emit(EVENTS.PLAYER_PAUSE), [socket])
  const seek = useCallback(
    (time: number) => socket.emit(EVENTS.PLAYER_SEEK, { currentTime: time }),
    [socket],
  )
  const prev = useCallback(() => socket.emit(EVENTS.PLAYER_PREV), [socket])

  return { play, pause, seek, next, prev }
}
