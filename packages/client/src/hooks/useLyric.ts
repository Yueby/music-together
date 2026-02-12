import { useCallback } from 'react'
import type { Track } from '@music-together/shared'
import { usePlayerStore } from '@/stores/playerStore'
import { SERVER_URL } from '@/lib/config'

export function useLyric() {
  const setLyric = usePlayerStore((s) => s.setLyric)

  const fetchLyric = useCallback(
    async (track: Track) => {
      if (!track.lyricId) {
        setLyric('', '')
        return
      }
      try {
        const res = await fetch(
          `${SERVER_URL}/api/music/lyric?source=${track.source}&lyricId=${encodeURIComponent(track.lyricId)}`,
        )
        if (!res.ok) throw new Error('Lyric fetch failed')
        const data = await res.json()
        setLyric(data.lyric || '', data.tlyric || '')
      } catch {
        setLyric('', '')
      }
    },
    [setLyric],
  )

  return { fetchLyric }
}
