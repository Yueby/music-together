import { useCallback, useEffect, useRef } from 'react'
import { EVENTS } from '@music-together/shared'
import { useSocketContext } from '@/providers/SocketProvider'
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
      // Deduplicate: ignore if the same track was requested within 2 seconds
      const now = Date.now()
      if (
        loadingRef.current?.trackId === data.track.id &&
        now - loadingRef.current.ts < 2000
      ) {
        return
      }
      loadingRef.current = { trackId: data.track.id, ts: now }

      loadTrack(data.track, data.playState.currentTime, data.playState.isPlaying)
      fetchLyric(data.track)
    })

    return () => {
      socket.off(EVENTS.PLAYER_PLAY)
    }
  }, [socket, loadTrack, fetchLyric])

  // Exposed controls
  const play = useCallback(() => socket.emit(EVENTS.PLAYER_PLAY), [socket])
  const pause = useCallback(() => socket.emit(EVENTS.PLAYER_PAUSE), [socket])
  const seek = useCallback(
    (time: number) => socket.emit(EVENTS.PLAYER_SEEK, { currentTime: time }),
    [socket],
  )

  return { play, pause, seek, next }
}
