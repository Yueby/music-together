import { create } from 'zustand'
import type { Track } from '@music-together/shared'
import { storage } from '@/lib/storage'

interface PlayerStore {
  currentTrack: Track | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  lyric: string
  tlyric: string
  syncDrift: number

  setCurrentTrack: (track: Track | null) => void
  setIsPlaying: (playing: boolean) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setVolume: (volume: number) => void
  setLyric: (lyric: string, tlyric?: string) => void
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
  setSyncDrift: (drift) => set({ syncDrift: drift }),
  reset: () => set({ currentTrack: null, isPlaying: false, currentTime: 0, duration: 0, lyric: '', tlyric: '', syncDrift: 0 }),
}))
