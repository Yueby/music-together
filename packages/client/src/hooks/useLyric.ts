import { SERVER_URL } from '@/lib/config'
import { usePlayerStore } from '@/stores/playerStore'
import type { Track } from '@music-together/shared'
import { useCallback, useRef } from 'react'

export function useLyric() {
  const setLyric = usePlayerStore((s) => s.setLyric)
  const abortRef = useRef<AbortController | null>(null)

  const fetchLyric = useCallback(
    async (track: Track) => {
      // Cancel any in-flight lyric request (e.g. rapid track switching)
      abortRef.current?.abort()
      abortRef.current = null

      if (!track.lyricId) {
        setLyric('', '')
        return
      }

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch(
          `${SERVER_URL}/api/music/lyric?source=${track.source}&lyricId=${encodeURIComponent(track.lyricId)}`,
          { signal: controller.signal },
        )
        if (!res.ok) throw new Error('Lyric fetch failed')
        const data = await res.json()
        setLyric(data.lyric || '', data.tlyric || '')
      } catch (err) {
        // Silently ignore aborted requests; clear lyrics for real errors
        if (err instanceof DOMException && err.name === 'AbortError') return
        setLyric('', '')
      }
    },
    [setLyric],
  )

  return { fetchLyric }
}
