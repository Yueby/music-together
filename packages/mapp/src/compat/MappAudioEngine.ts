import type { MiniAppSDK } from '@discourse-mini-app/sdk'
import type { AudioLoadProgress } from '../../../client/src/lib/PlaybackSound.ts'
import { WebAudioPlayer, type WebAudioPlayerSnapshot } from './WebAudioPlayer.ts'
import {
  readRoomAudio,
  RoomAudioError,
  type ReadRoomAudioOptions,
  type RoomAudioErrorCode,
  type RoomAudioProgress,
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

type PreloadRoomTrackOptions = Omit<ReadRoomAudioOptions, 'sdk' | 'signal' | 'onProgress'>

export type LoadRoomTrackOptions = PreloadRoomTrackOptions & {
  signal?: AbortSignal
  onLoadProgress?: (progress: AudioLoadProgress) => void
}

/** The bytes of the announced next track, being fetched (or already fetched) ahead of its turn. */
interface PreloadedTrack {
  roomId: string
  trackId: string
  controller: AbortController
  result: Promise<RoomAudioResult>
  done: boolean
  lastProgress?: RoomAudioProgress
  onProgress?: (progress: RoomAudioProgress) => void
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
  private trackRoomId: string | null = null
  private loading = false
  private errorCode: MappAudioEngineErrorCode | null = null
  /** At most one: the compressed bytes only (decoded audio is far larger), so memory stays bounded. */
  private preloaded: PreloadedTrack | null = null
  private pendingPreload: PreloadRoomTrackOptions | null = null

  constructor(options: MappAudioEngineOptions) {
    this.sdk = options.sdk
    this.onChange = options.onChange
    this.player = new WebAudioPlayer({ createContext: options.createContext, onChange: () => this.notify() })
  }

  snapshot(): MappAudioEngineSnapshot {
    return { trackId: this.trackId, loading: this.loading, errorCode: this.errorCode, audio: this.player.snapshot() }
  }

  canReuseTrack(roomId: string, trackId: string): boolean {
    return !this.disposed && !this.loading && this.trackRoomId === roomId && this.trackId === trackId &&
      this.player.snapshot().duration > 0
  }

  /** False means cancelled, superseded or failed; only fixed error codes enter the snapshot. */
  async loadRoomTrack(options: LoadRoomTrackOptions): Promise<boolean> {
    if (this.disposed) return false
    if (!options.signal?.aborted && this.canReuseTrack(options.roomId, options.trackId)) {
      this.assertAudio()
      this.invalidate()
      const generation = this.generation
      this.errorCode = null
      this.player.pause()
      if (!this.current(generation)) return false
      this.player.seek(0)
      return this.current(generation)
    }
    this.invalidate()
    this.pendingPreload = null
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
      const reportProgress = (progress: AudioLoadProgress) => {
        if (this.current(generation)) options.onLoadProgress?.(progress)
      }
      reportProgress({ phase: 'buffering' })
      if (!this.current(generation)) return false
      const result = await this.readTrackBytes(options, controller, ({ loadedBytes, totalBytes }) =>
        reportProgress({
          phase: 'downloading',
          loadedBytes,
          totalBytes,
          progress: totalBytes && totalBytes > 0 ? Math.min(1, loadedBytes / totalBytes) : undefined,
        }),
      )
      if (!this.current(generation)) return false
      reportProgress({
        phase: 'decoding',
        progress: 1,
        loadedBytes: result.bytes.byteLength,
        totalBytes: result.bytes.byteLength,
      })
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
      this.trackRoomId = options.roomId
      this.notify()
      if (this.current(generation) && !this.loading && this.pendingPreload) {
        const deferred = this.pendingPreload
        this.pendingPreload = null
        this.preloadRoomTrack(deferred)
      }
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
  preloadRoomTrack(options: PreloadRoomTrackOptions): void {
    if (this.disposed) return
    if (this.trackId === options.trackId) {
      this.pendingPreload = null
      return
    }
    const known = this.preloaded
    const matches = known && known.roomId === options.roomId && known.trackId === options.trackId
    if (this.loading) {
      if (known && !matches) this.discardPreload()
      this.pendingPreload = { ...options }
      return
    }
    this.pendingPreload = null
    if (matches) return
    this.discardPreload()
    const controller = new AbortController()
    const entry: PreloadedTrack = {
      roomId: options.roomId,
      trackId: options.trackId,
      controller,
      done: false,
      result: readRoomAudio({
        ...options,
        sdk: this.sdk,
        signal: controller.signal,
        onProgress: (progress) => {
          entry.lastProgress = progress
          entry.onProgress?.(progress)
        },
      }).then((result) => {
        entry.done = true
        return result
      }),
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
  private async readTrackBytes(
    { roomId, trackId, mode }: LoadRoomTrackOptions,
    controller: AbortController,
    onProgress: (progress: RoomAudioProgress) => void,
  ): Promise<RoomAudioResult> {
    const preloaded = this.preloaded
    if (preloaded && preloaded.roomId === roomId && preloaded.trackId === trackId) {
      // The load now owns the transfer: cancelling the load cancels it.
      this.preloaded = null
      if (preloaded.done) return preloaded.result
      const cancelPreload = () => preloaded.controller.abort()
      controller.signal.addEventListener('abort', cancelPreload, { once: true })
      try {
        preloaded.onProgress = onProgress
        if (preloaded.lastProgress) onProgress(preloaded.lastProgress)
        return await preloaded.result
      } catch (error) {
        if (controller.signal.aborted) throw error
        // The preload failed on its own; fall through to a direct read.
      } finally {
        preloaded.onProgress = undefined
        controller.signal.removeEventListener('abort', cancelPreload)
      }
    }
    return readRoomAudio({ roomId, trackId, mode, sdk: this.sdk, signal: controller.signal, onProgress })
  }

  cancel(): void {
    if (this.disposed) return
    this.invalidate()
    this.pendingPreload = null
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

  getOutputLatencyMs(): number {
    return this.player.getOutputLatencyMs()
  }

  crossfadeSeek(position: number): void {
    this.assertAudio()
    if (this.loading || !this.trackId) throw new MappAudioEngineError('AUDIO_NOT_LOADED')
    try {
      this.player.crossfadeSeek(position)
    } catch {
      this.failAudio('AUDIO_SEEK_FAILED')
    }
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
    this.pendingPreload = null
    this.trackId = null
    this.trackRoomId = null
    this.loading = false
    this.errorCode = null
    this.player.unload()
    this.notify()
  }

  dispose(): Promise<void> {
    if (this.disposal) return this.disposal
    this.disposed = true
    this.invalidate()
    this.pendingPreload = null
    this.discardPreload()
    this.trackId = null
    this.trackRoomId = null
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
