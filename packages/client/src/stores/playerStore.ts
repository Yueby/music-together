import { create } from 'zustand'
import type { Track } from '@music-together/shared'
import type { LyricLine as AMLLLyricLine } from '@applemusic-like-lyrics/core'
import { normalizeAudioLatencyOffset, storage } from '@/lib/storage'
import type { AudioLoadPhase } from '@/lib/PlaybackSound'

interface AudioLoadStateUpdate {
  phase: AudioLoadPhase
  progress?: number | null
  loadedBytes?: number | null
  startedAt?: number | null
}

const idleAudioLoadState = {
  audioLoadPhase: 'idle',
  audioLoadProgress: null,
  audioLoadedBytes: null,
  audioLoadStartedAt: null,
} as const

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
  audioLoadPhase: AudioLoadPhase
  audioLoadProgress: number | null
  audioLoadedBytes: number | null
  audioLoadStartedAt: number | null
  syncDrift: number
  audioLatencyOffsetMs: number | null
  detectedAudioLatencyMs: number
  lowFreqVolume: number

  setCurrentTrack: (track: Track | null) => void
  setIsPlaying: (playing: boolean) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setVolume: (volume: number) => void
  setLyric: (lyric: string, tlyric?: string) => void
  setTtmlLines: (lines: AMLLLyricLine[] | null) => void
  setLyricLoading: (loading: boolean) => void
  setAudioLoadState: (state: AudioLoadStateUpdate) => void
  setSyncDrift: (drift: number) => void
  setAudioLatencyOffsetMs: (offset: number | null) => void
  setDetectedAudioLatencyMs: (offset: number) => void
  setLowFreqVolume: (volume: number) => void
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
  ...idleAudioLoadState,
  syncDrift: 0,
  audioLatencyOffsetMs: storage.getAudioLatencyOffsetMs(),
  detectedAudioLatencyMs: 0,
  lowFreqVolume: 1,

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
  setAudioLoadState: ({ phase, progress, loadedBytes, startedAt }) =>
    set((previous) => {
      if (phase === 'idle') return idleAudioLoadState
      let nextProgress = previous.audioLoadProgress
      if (progress === null) nextProgress = null
      else if (typeof progress === 'number' && Number.isFinite(progress)) {
        nextProgress = Math.max(0, Math.min(1, progress))
      }
      return {
        audioLoadPhase: phase,
        audioLoadProgress: nextProgress,
        audioLoadedBytes:
          loadedBytes === null || (typeof loadedBytes === 'number' && Number.isFinite(loadedBytes))
            ? loadedBytes
            : previous.audioLoadedBytes,
        audioLoadStartedAt: startedAt === undefined ? (previous.audioLoadStartedAt ?? Date.now()) : startedAt,
      }
    }),
  setSyncDrift: (syncDrift) => set((state) => (state.syncDrift === syncDrift ? state : { syncDrift })),
  setAudioLatencyOffsetMs: (offset) => {
    const audioLatencyOffsetMs = normalizeAudioLatencyOffset(offset)
    storage.setAudioLatencyOffsetMs(audioLatencyOffsetMs)
    set({ audioLatencyOffsetMs })
  },
  setDetectedAudioLatencyMs: (detectedAudioLatencyMs) => set((state) =>
    state.detectedAudioLatencyMs === detectedAudioLatencyMs ? state : { detectedAudioLatencyMs },
  ),
  setLowFreqVolume: (lowFreqVolume) => set({ lowFreqVolume }),
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
      ...idleAudioLoadState,
      syncDrift: 0,
      lowFreqVolume: 1,
    }),
}))
