export type WebAudioPlayerStatus = 'empty' | 'ready' | 'scheduled' | 'playing' | 'paused' | 'ended' | 'closed'

export interface WebAudioPlayerSnapshot {
  status: WebAudioPlayerStatus
  position: number
  duration: number
  contextState: AudioContextState | 'not-created'
}

interface WebAudioPlayerOptions {
  loop?: boolean
  createContext?: () => AudioContext
  onChange?: (snapshot: WebAudioPlayerSnapshot) => void
}

/** A single decoded buffer; all positions and scheduled starts use the audio clock. */
export class WebAudioPlayer {
  private context: AudioContext | null = null
  private gain: GainNode | null = null
  private buffer: AudioBuffer | null = null
  private source: AudioBufferSourceNode | null = null
  private status: WebAudioPlayerStatus = 'empty'
  private offset = 0
  private startedAt = 0
  private storedVolume = 0.12
  private storedRate = 1
  private generation = 0
  private readonly loop: boolean
  private readonly createContext: () => AudioContext
  private readonly onChange: (snapshot: WebAudioPlayerSnapshot) => void

  constructor(options: WebAudioPlayerOptions = {}) {
    this.loop = options.loop ?? false
    this.createContext = options.createContext ?? (() => new AudioContext())
    this.onChange = options.onChange ?? (() => {})
  }

  snapshot(): WebAudioPlayerSnapshot {
    const duration = this.buffer?.duration ?? 0
    const elapsed =
      this.source && this.context ? Math.max(0, this.context.currentTime - this.startedAt) * this.storedRate : 0
    const position = this.offset + elapsed
    return {
      status: this.source && this.context && this.context.currentTime < this.startedAt ? 'scheduled' : this.status,
      position: this.loop && this.source && duration > 0 ? position % duration : Math.min(duration, position),
      duration,
      contextState: this.context?.state ?? 'not-created',
    }
  }

  getVolume(): number {
    return this.storedVolume
  }

  setVolume(volume: number): void {
    this.assertOpen()
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) throw new Error('INVALID_VOLUME')
    if (this.gain) this.gain.gain.value = volume
    this.storedVolume = volume
    this.notify()
  }

  getPlaybackRate(): number {
    return this.storedRate
  }

  setPlaybackRate(rate: number): void {
    this.assertOpen()
    if (!Number.isFinite(rate) || rate < 0.5 || rate > 2) throw new Error('INVALID_PLAYBACK_RATE')
    if (this.source && this.context) {
      const position = this.snapshot().position
      // A scheduled source must retain its future deadline, not start advancing now.
      const startedAt = Math.max(this.startedAt, this.context.currentTime)
      this.source.playbackRate.value = rate
      this.offset = position
      this.startedAt = startedAt
    }
    this.storedRate = rate
    this.notify()
  }

  async load(bytes: Uint8Array): Promise<boolean> {
    this.assertOpen()
    const generation = ++this.generation
    this.stopSource()
    this.buffer = null
    this.offset = 0
    this.status = 'empty'
    const context = this.getContext()
    this.notify()
    try {
      // decodeAudioData can detach its input; never transfer SDK-owned bytes.
      const buffer = await context.decodeAudioData(Uint8Array.from(bytes).buffer)
      if (generation !== this.generation) return false
      if (!Number.isFinite(buffer.duration) || buffer.duration <= 0) throw new Error('INVALID_AUDIO_DURATION')
      this.buffer = buffer
      this.status = 'ready'
      this.notify()
      return true
    } catch (error) {
      if (generation !== this.generation) return false
      throw error
    }
  }

  /** Unlock without starting a source; invoke directly from a user gesture. */
  async unlock(): Promise<boolean> {
    this.assertOpen()
    const context = this.getContext()
    await context.resume()
    // Unlocking is about the AudioContext, not the current track: loading, pausing or seeking while resume() was
    // pending bumps the track generation but must not turn a running context into a failed unlock.
    if (this.status === 'closed') return false
    if (context.state !== 'running') throw new Error('AUDIO_CONTEXT_NOT_RUNNING')
    this.notify()
    return true
  }

  /** Invalidate pending async work while leaving an already playing source intact. */
  cancelPendingOperations(): void {
    if (this.status !== 'closed') ++this.generation
  }

  /** Call directly from a user event: resume is invoked before the first await. */
  async play(delaySeconds = 0, getPosition?: () => number): Promise<boolean> {
    this.assertOpen()
    if (!this.buffer) throw new Error('AUDIO_NOT_LOADED')
    if (!Number.isFinite(delaySeconds) || delaySeconds < 0 || delaySeconds > 60) throw new Error('INVALID_DELAY')
    const context = this.getContext()
    const generation = ++this.generation
    const position = this.snapshot().position
    this.stopSource()
    this.offset = position >= this.buffer.duration ? 0 : position
    this.status = 'paused'
    this.notify()
    try {
      await context.resume()
      if (generation !== this.generation) return false
      if (context.state !== 'running') throw new Error('AUDIO_CONTEXT_NOT_RUNNING')
      if (getPosition) {
        const target = getPosition()
        if (!Number.isFinite(target)) throw new Error('INVALID_POSITION')
        this.offset = this.loop
          ? ((target % this.buffer!.duration) + this.buffer!.duration) % this.buffer!.duration
          : Math.max(0, Math.min(target, this.buffer!.duration))
      }
      this.startSource(delaySeconds)
      return true
    } catch (error) {
      if (generation !== this.generation) return false
      throw error
    }
  }

  pause(): void {
    this.assertOpen()
    ++this.generation
    this.offset = this.snapshot().position
    this.stopSource()
    this.status = this.buffer ? 'paused' : 'empty'
    this.notify()
  }

  seek(position: number): void {
    this.assertOpen()
    if (!this.buffer) throw new Error('AUDIO_NOT_LOADED')
    if (!Number.isFinite(position)) throw new Error('INVALID_POSITION')
    ++this.generation
    const wasActive = this.source !== null
    const delay = this.context ? Math.max(0, this.startedAt - this.context.currentTime) : 0
    this.stopSource()
    this.offset = Math.max(0, Math.min(position, this.buffer.duration))
    if (this.offset === this.buffer.duration) this.status = 'ended'
    else if (wasActive) this.startSource(delay)
    else this.status = this.status === 'ready' ? 'ready' : 'paused'
    this.notify()
  }

  /** Release a track while retaining this app's unlocked context and controls. */
  unload(): void {
    if (this.status === 'closed') return
    ++this.generation
    this.stopSource()
    this.buffer = null
    this.offset = 0
    this.startedAt = 0
    this.status = 'empty'
    this.notify()
  }

  async dispose(): Promise<void> {
    if (this.status === 'closed') return
    ++this.generation
    this.stopSource()
    this.gain?.disconnect()
    this.buffer = null
    this.offset = 0
    this.status = 'closed'
    this.context?.removeEventListener('statechange', this.notify)
    this.notify()
    if (this.context && this.context.state !== 'closed') await this.context.close()
  }

  private assertOpen(): void {
    if (this.status === 'closed') throw new Error('APP_UNLOADED')
  }

  private getContext(): AudioContext {
    if (!this.context) {
      const context = this.createContext()
      this.context = context
      this.gain = context.createGain()
      this.gain.gain.value = this.storedVolume
      this.gain.connect(context.destination)
      context.addEventListener('statechange', this.notify)
    }
    return this.context
  }

  private startSource(delay: number): void {
    const context = this.context!
    const source = context.createBufferSource()
    source.buffer = this.buffer
    source.loop = this.loop
    source.playbackRate.value = this.storedRate
    source.connect(this.gain!)
    this.startedAt = context.currentTime + delay
    this.source = source
    this.status = 'playing'
    source.onended = () => {
      if (this.source !== source) return
      this.source = null
      source.disconnect()
      this.offset = this.buffer?.duration ?? 0
      this.status = 'ended'
      this.notify()
    }
    try {
      source.start(this.startedAt, this.offset)
    } catch (error) {
      this.stopSource()
      this.status = 'paused'
      throw error
    }
    this.notify()
  }

  private stopSource(): void {
    const source = this.source
    this.source = null
    if (!source) return
    source.onended = null
    try {
      source.stop()
    } catch {
      /* It may have already ended. */
    }
    source.disconnect()
  }

  private readonly notify = (): void => this.onChange(this.snapshot())
}
