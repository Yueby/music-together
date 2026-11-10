import type { MiniAppSDK } from '@discourse-mini-app/sdk'
import { WebAudioPlayer, type WebAudioPlayerSnapshot } from './WebAudioPlayer.ts'
import {
  readRoomAudio,
  RoomAudioError,
  type ReadRoomAudioOptions,
  type RoomAudioErrorCode,
  type RoomAudioResult,
} from './RoomAudioSource.ts'

export type MappAudioEngineErrorCode =
  | RoomAudioErrorCode
  | 'AUDIO_PERMISSION_REQUIRED'
  | 'AUDIO_NOT_LOADED'
  | 'AUDIO_DECODE_FAILED'
  | 'AUDIO_PLAY_FAILED'
  | 'AUDIO_SEEK_FAILED'
  | 'AUDIO_VOLUME_FAILED'
  | 'AUDIO_RATE_FAILED'
  | 'AUDIO_UNLOCK_FAILED'
  | 'DISPOSED'

export class MappAudioEngineError extends Error {
  constructor(readonly code: MappAudioEngineErrorCode) {
    super(code)
    this.name = 'MappAudioEngineError'
  }
}

export interface MappAudioEngineSnapshot {
  /** The successfully decoded track, not an in-flight request's identity. */
  readonly trackId: string | null
  readonly loading: boolean
  readonly errorCode: MappAudioEngineErrorCode | null
  readonly audio: WebAudioPlayerSnapshot
}

export interface MappAudioEngineOptions {
  sdk: MiniAppSDK
  createContext?: () => AudioContext
  onChange?: (snapshot: MappAudioEngineSnapshot) => void
}

export type LoadRoomTrackOptions = Omit<ReadRoomAudioOptions, 'sdk'>

/** The bytes of the announced next track, being fetched (or already fetched) ahead of its turn. */
interface PreloadedTrack {
  roomId: string
  trackId: string
  controller: AbortController
  result: Promise<RoomAudioResult>
}

/** Transport/lifetime adapter only. WebAudioPlayer retains all audio-clock and source scheduling. */
export class MappAudioEngine {
  private readonly player: WebAudioPlayer
  private readonly sdk: MiniAppSDK
  private readonly onChange?: MappAudioEngineOptions['onChange']
  private generation = 0
  private controller: AbortController | null = null
  private disposed = false
  private disposal: Promise<void> | null = null
  private trackId: string | null = null
  private loading = false
  private errorCode: MappAudioEngineErrorCode | null = null
  /** At most one: the compressed bytes only (decoded audio is far larger), so memory stays bounded. */
  private preloaded: PreloadedTrack | null = null

  constructor(options: MappAudioEngineOptions) {
    this.sdk = options.sdk
    this.onChange = options.onChange
    this.player = new WebAudioPlayer({ createContext: options.createContext, onChange: () => this.notify() })
  }

  snapshot(): MappAudioEngineSnapshot {
    return { trackId: this.trackId, loading: this.loading, errorCode: this.errorCode, audio: this.player.snapshot() }
  }

  /** False means cancelled, superseded or failed; only fixed error codes enter the snapshot. */
  async loadRoomTrack(options: LoadRoomTrackOptions): Promise<boolean> {
    if (this.disposed) return false
    this.invalidate()
    const generation = this.generation
    const controller = new AbortController()
    this.controller = controller
    this.trackId = null
    this.loading = true
    this.errorCode = null
    const abort = () => {
      if (this.current(generation)) this.cancel()
    }
    options.signal?.addEventListener('abort', abort, { once: true })
    try {
      if (options.signal?.aborted) {
        abort()
        return false
      }
      this.assertAudio()
      // Stop the previous track while fetching, without inventing a second playback kernel.
      this.player.pause()
      this.notify()
      if (!this.current(generation)) return false
      const result = await this.readTrackBytes(options, controller)
      if (!this.current(generation)) return false
      const loaded = await this.decode(result.bytes, controller.signal)
      if (!this.current(generation)) return false
      this.loading = false
      if (!loaded) {
        this.errorCode = 'ABORTED'
        this.notify()
        return false
      }
      this.trackId = result.trackId
      this.notify()
      return this.current(generation)
    } catch (error) {
      if (!this.current(generation)) return false
      this.loading = false
      this.errorCode =
        error instanceof RoomAudioError || error instanceof MappAudioEngineError ? error.code : 'AUDIO_DECODE_FAILED'
      this.notify()
      return false
    } finally {
      options.signal?.removeEventListener('abort', abort)
      if (this.current(generation)) this.controller = null
    }
  }

  /**
   * Fetch the bytes of the track that will probably play next while the current one plays. Downloading a whole file
   * through the SDK takes seconds; loadRoomTrack takes these bytes over when that track's turn comes, and only the
   * decoding is left. A failed or superseded preload costs nothing: the real load simply reads the track itself.
   */
  preloadRoomTrack(options: Omit<LoadRoomTrackOptions, 'signal'>): void {
    if (this.disposed) return
    const known = this.preloaded
    if (known && known.roomId === options.roomId && known.trackId === options.trackId) return
    if (this.trackId === options.trackId) return
    this.discardPreload()
    const controller = new AbortController()
    const entry: PreloadedTrack = {
      roomId: options.roomId,
      trackId: options.trackId,
      controller,
      result: readRoomAudio({ ...options, sdk: this.sdk, signal: controller.signal }),
    }
    // A failed read is forgotten, so the real load starts its own.
    entry.result.catch(() => {
      if (this.preloaded === entry) this.preloaded = null
    })
    this.preloaded = entry
  }

  private discardPreload(): void {
    this.preloaded?.controller.abort()
    this.preloaded = null
  }

  /** The preloaded bytes when they are for this very track, otherwise a normal read. */
  private async readTrackBytes(options: LoadRoomTrackOptions, controller: AbortController): Promise<RoomAudioResult> {
    const preloaded = this.preloaded
    if (preloaded && preloaded.roomId === options.roomId && preloaded.trackId === options.trackId) {
      // The load now owns the transfer: cancelling the load cancels it.
      this.preloaded = null
      const cancelPreload = () => preloaded.controller.abort()
      controller.signal.addEventListener('abort', cancelPreload, { once: true })
      try {
        return await Promise.race([
          preloaded.result,
          new Promise<never>((_, reject) =>
            controller.signal.addEventListener('abort', () => reject(new RoomAudioError('ABORTED')), { once: true }),
          ),
        ])
      } catch (error) {
        if (controller.signal.aborted) throw error
        // The preload failed on its own; fall through to a direct read.
      } finally {
        controller.signal.removeEventListener('abort', cancelPreload)
      }
    }
    return readRoomAudio({ ...options, sdk: this.sdk, signal: controller.signal })
  }

  cancel(): void {
    if (this.disposed) return
    this.invalidate()
    this.loading = false
    this.errorCode = 'ABORTED'
    this.notify()
  }

  async play(delaySeconds = 0, getPosition?: () => number): Promise<boolean> {
    this.assertAudio()
    if (this.loading || !this.trackId) throw new MappAudioEngineError('AUDIO_NOT_LOADED')
    return this.runAudio(() => this.player.play(delaySeconds, getPosition), 'AUDIO_PLAY_FAILED')
  }

  pause(): void {
    this.assertAudio()
    if (this.loading) this.cancel()
    this.player.pause()
  }

  seek(position: number): void {
    this.assertAudio()
    if (this.loading || !this.trackId) throw new MappAudioEngineError('AUDIO_NOT_LOADED')
    try {
      this.player.seek(position)
    } catch {
      this.failAudio('AUDIO_SEEK_FAILED')
    }
  }

  getVolume(): number {
    return this.player.getVolume()
  }

  setVolume(volume: number): void {
    this.assertAudio()
    try {
      this.player.setVolume(volume)
    } catch {
      this.failAudio('AUDIO_VOLUME_FAILED')
    }
  }

  getPlaybackRate(): number {
    return this.player.getPlaybackRate()
  }

  setPlaybackRate(rate: number): void {
    this.assertAudio()
    try {
      this.player.setPlaybackRate(rate)
    } catch {
      this.failAudio('AUDIO_RATE_FAILED')
    }
  }

  async unlock(): Promise<boolean> {
    this.assertAudio()
    // An async function runs synchronously up to its first await, so player.unlock still
    // executes inside the caller's user gesture.
    return this.runAudio(() => this.player.unlock(), 'AUDIO_UNLOCK_FAILED')
  }

  /** Cancel and release the current track without closing the shared audio context. */
  unload(): void {
    if (this.disposed) return
    this.invalidate()
    this.trackId = null
    this.loading = false
    this.errorCode = null
    this.player.unload()
    this.notify()
  }

  dispose(): Promise<void> {
    if (this.disposal) return this.disposal
    this.disposed = true
    this.invalidate()
    this.discardPreload()
    this.trackId = null
    this.loading = false
    this.errorCode = 'DISPOSED'
    this.disposal = this.player.dispose().catch(() => {
      throw new MappAudioEngineError('DISPOSED')
    })
    return this.disposal
  }

  private invalidate(): void {
    ++this.generation
    this.controller?.abort()
    this.controller = null
    this.player.cancelPendingOperations()
  }

  private current(generation: number): boolean {
    return !this.disposed && generation === this.generation
  }

  private assertAudio(): void {
    if (this.disposed) throw new MappAudioEngineError('DISPOSED')
    if (!this.sdk.permissions.has('audio.webAudio')) throw new MappAudioEngineError('AUDIO_PERMISSION_REQUIRED')
  }

  private async runAudio(operation: () => Promise<boolean>, code: MappAudioEngineErrorCode): Promise<boolean> {
    const generation = this.generation
    try {
      const completed = await operation()
      return this.current(generation) && completed
    } catch {
      if (!this.current(generation)) return false
      return this.failAudio(code)
    }
  }

  private failAudio(code: MappAudioEngineErrorCode): never {
    this.errorCode = code
    this.notify()
    throw new MappAudioEngineError(code)
  }

  /** Resolves false as soon as the signal aborts, even while decoding is still running. */
  private async decode(bytes: Uint8Array, signal: AbortSignal): Promise<boolean> {
    const aborted = new Promise<false>((resolve) => signal.addEventListener('abort', () => resolve(false), { once: true }))
    const loaded = await Promise.race([this.player.load(bytes), aborted])
    return loaded && !signal.aborted
  }

  private notify(): void {
    if (!this.disposed) this.onChange?.(this.snapshot())
  }
}
