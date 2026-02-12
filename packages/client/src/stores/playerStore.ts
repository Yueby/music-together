import { create } from 'zustand'
import type { Track } from '@music-together/shared'

interface PlayerStore {
  currentTrack: Track | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  queue: Track[]
  lyric: string
  tlyric: string

  setCurrentTrack: (track: Track | null) => void
  setIsPlaying: (playing: boolean) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setVolume: (volume: number) => void
  setQueue: (queue: Track[]) => void
  setLyric: (lyric: string, tlyric?: string) => void
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  queue: [],
  lyric: '',
  tlyric: '',

  setCurrentTrack: (track) => set({ currentTrack: track }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume }),
  setQueue: (queue) => set({ queue }),
  setLyric: (lyric, tlyric) => set({ lyric, tlyric: tlyric ?? '' }),
}))
