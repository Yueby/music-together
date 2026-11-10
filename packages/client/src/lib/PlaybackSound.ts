import type { Track } from '@music-together/shared'

/** The media operations consumed by the shared player hooks, without a native audio dependency. */
export interface PlaybackSound {
  state(): 'unloaded' | 'loading' | 'loaded'
  duration(): number
  playing(soundId?: number): boolean
  /** No position means read. Pass a sound ID as the second argument to avoid ID/position ambiguity. */
  seek(position?: number, soundId?: number): unknown
  play(soundId?: number): number
  pause(soundId?: number): unknown
  rate(): number
  rate(value: number): unknown
  volume(value: number): unknown
  once(event: 'play' | 'unlock', listener: (soundId: number) => void): unknown
  load(): unknown
  unload(): unknown
}

export interface PlaybackSoundOptions {
  src: string[]
  html5?: boolean
  format?: string[]
  volume?: number
  onload?: () => void
  onplay?: () => void
  onpause?: () => void
  onend?: () => void
  onloaderror?: (soundId: number, error: unknown) => void
  onplayerror?: (soundId: number, error?: unknown) => void
}

export interface PlaybackSoundFactory {
  /** Create returns before any lifecycle callback can run. */
  create(track: Track, options: PlaybackSoundOptions): PlaybackSound
  readonly allowLoadRetry: boolean
  readonly supportsHtml5Analysis: boolean
}
