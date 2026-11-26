import type { Track } from '@music-together/shared'

/** The media operations consumed by the shared player hooks, without a native audio dependency. */
export interface PlaybackSound {
  state(): 'unloaded' | 'loading' | 'loaded'
  duration(): number
  playing(soundId?: number): boolean
  /** No position means read. Pass a sound ID as the second argument to avoid ID/position ambiguity. */
  seek(position?: number, soundId?: number): unknown
  play(soundId?: number): number
  playScheduled?(delaySeconds: number, getPosition?: () => number): number
  supportsPitchPreservingRate?: boolean
  getOutputLatencyMs?(): number
  crossfadeSeek?(position: number): void
  pause(soundId?: number): unknown
  rate(): number
  rate(value: number): unknown
  volume(value: number): unknown
  once(event: 'play' | 'unlock', listener: (soundId: number) => void): unknown
  load(): unknown
  unload(): unknown
  /** Returns the underlying HTMLAudioElement for same-origin WebAudio analysis and marks it non-recyclable. */
  claimMediaElementForAnalysis?(): HTMLAudioElement | null
}

export type AudioLoadPhase = 'idle' | 'buffering' | 'downloading' | 'decoding' | 'waiting'

export interface AudioLoadProgress {
  phase: Exclude<AudioLoadPhase, 'idle' | 'waiting'>
  /** Normalized download progress (0–1) when total byte length is known. */
  progress?: number
  loadedBytes?: number
  totalBytes?: number
}

export interface PlaybackSoundOptions {
  src: string[]
  html5?: boolean
  preload?: boolean
  autoplay?: boolean
  format?: string[]
  volume?: number
  onload?: () => void
  onprogress?: (info: AudioLoadProgress) => void
  onplay?: () => void
  onpause?: () => void
  onend?: () => void
  onloaderror?: (soundId: number, error: unknown) => void
  onplayerror?: (soundId: number, error?: unknown) => void
}

export interface PlaybackSoundFactory {
  /** Create returns before any lifecycle callback can run. */
  create(track: Track, options: PlaybackSoundOptions): PlaybackSound
  /**
   * The track that will most likely play next, announced while the current one is still playing. Best effort:
   * fetch what makes its start faster, keep at most one, never throw and never start playback.
   */
  preload?(track: Track): void
  readonly allowLoadRetry: boolean
  readonly supportsHtml5Analysis: boolean
}
