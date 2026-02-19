import { create } from 'zustand'
import type { Track } from '@music-together/shared'
import type { LyricLine as AMLLLyricLine } from '@applemusic-like-lyrics/core'
import { storage } from '@/lib/storage'

interface PlayerStore {
  currentTrack: Track | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  lyric: string
  tlyric: string
  ttmlLines: AMLLLyricLine[] | null
  lyricLoading: boolean
  syncDrift: number

  setCurrentTrack: (track: Track | null) => void
  setIsPlaying: (playing: boolean) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setVolume: (volume: number) => void
  setLyric: (lyric: string, tlyric?: string) => void
  setTtmlLines: (lines: AMLLLyricLine[] | null) => void
  setLyricLoading: (loading: boolean) => void
  setSyncDrift: (drift: number) => void
  reset: () => void
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: storage.getVolume(),
  lyric: '',
  tlyric: '',
  ttmlLines: null,
  lyricLoading: false,
  syncDrift: 0,

  setCurrentTrack: (track) => set({ currentTrack: track }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => {
    storage.setVolume(volume)
    set({ volume })
  },
  setLyric: (lyric, tlyric) => set({ lyric, tlyric: tlyric ?? '' }),
  setTtmlLines: (lines) => set({ ttmlLines: lines }),
  setLyricLoading: (loading) => set({ lyricLoading: loading }),
  setSyncDrift: (drift) => set({ syncDrift: drift }),
  reset: () =>
    set({
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      lyric: '',
      tlyric: '',
      ttmlLines: null,
      lyricLoading: false,
      syncDrift: 0,
    }),
}))
