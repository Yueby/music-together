// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createHtmlAudioSound,
  isHtmlAudioPoolUnlocked,
  resetHtmlAudioPoolForTests,
  unlockHtmlAudioPool,
} from './htmlAudioSound'

class FakeAudioElement extends EventTarget {
  static instances: FakeAudioElement[] = []

  src = ''
  preload = ''
  volume = 1
  muted = false
  playbackRate = 1
  defaultPlaybackRate = 1
  preservesPitch = false
  currentTime = 0
  duration = 120
  readyState = 0
  paused = true
  ended = false
  error: MediaError | null = null
  buffered = {
    length: 0,
    start: () => 0,
    end: () => 0,
  }

  play = vi.fn((): Promise<void> => {
    this.paused = false
    this.ended = false
    return Promise.resolve()
  })
  pause = vi.fn(() => {
    this.paused = true
  })
  load = vi.fn()
  removeAttribute = vi.fn((name: string) => {
    if (name === 'src') this.src = ''
  })

  constructor() {
    super()
    FakeAudioElement.instances.push(this)
  }

  emitCanPlay() {
    this.readyState = 3
    this.dispatchEvent(new Event('canplay'))
  }

  emitProgress(bufferedEnd: number, duration = this.duration) {
    this.duration = duration
    this.buffered = {
      length: 1,
      start: () => 0,
      end: () => bufferedEnd,
    }
    this.dispatchEvent(new Event('progress'))
  }

  emitError() {
    this.error = { code: 4, message: 'MEDIA_ERR_SRC_NOT_SUPPORTED' } as MediaError
    this.dispatchEvent(new Event('error'))
  }

  emitEnded() {
    this.paused = true
    this.ended = true
    this.dispatchEvent(new Event('ended'))
  }
}

describe('htmlAudioSound', () => {
  beforeEach(() => {
    FakeAudioElement.instances = []
    vi.stubGlobal('Audio', FakeAudioElement)
    resetHtmlAudioPoolForTests()
  })

  afterEach(() => {
    resetHtmlAudioPoolForTests()
    vi.unstubAllGlobals()
  })

  it('loads, reports buffering progress, seeks in place without pausing, preserves pitch, and plays', async () => {
    const onload = vi.fn()
    const onprogress = vi.fn()
    const onplay = vi.fn()
    const onpause = vi.fn()
    const onend = vi.fn()
    const oncePlay = vi.fn()

    const sound = createHtmlAudioSound({
      src: ['https://audio.example.test/track.mp3'],
      volume: 0.4,
      onload,
      onprogress,
      onplay,
      onpause,
      onend,
    })

    expect(sound.state()).toBe('loading')
    expect(onload).not.toHaveBeenCalled()
    expect(FakeAudioElement.instances).toHaveLength(1)
    const el = FakeAudioElement.instances[0]
    expect(el.src).toBe('https://audio.example.test/track.mp3')
    expect(el.volume).toBe(0.4)
    expect(el.preservesPitch).toBe(true)

    el.emitProgress(30, 120)
    expect(onprogress).toHaveBeenCalledWith({ phase: 'buffering', progress: 0.25 })

    // Pending seek during loading is applied on canplay
    sound.seek(15)
    expect(sound.seek()).toBe(15)
    el.emitCanPlay()
    expect(sound.state()).toBe('loaded')
    expect(onload).toHaveBeenCalledOnce()
    expect(el.currentTime).toBe(15)

    // Subsequent progress events after load are ignored
    onprogress.mockClear()
    el.emitProgress(60, 120)
    expect(onprogress).not.toHaveBeenCalled()

    const soundId = sound.play()
    sound.once('play', oncePlay)
    expect(sound.playing(soundId)).toBe(true)
    await Promise.resolve()
    expect(onplay).toHaveBeenCalledOnce()
    expect(oncePlay).toHaveBeenCalledExactlyOnceWith(soundId)

    // Seeking while playing updates currentTime directly without pausing
    el.pause.mockClear()
    sound.seek(42, soundId)
    expect(el.currentTime).toBe(42)
    expect(el.pause).not.toHaveBeenCalled()
    expect(sound.playing(soundId)).toBe(true)

    // Rate adjustment keeps pitch preservation enabled
    sound.rate(1.015)
    expect(sound.rate()).toBe(1.015)
    expect(el.preservesPitch).toBe(true)

    sound.pause(soundId)
    expect(sound.playing(soundId)).toBe(false)
    expect(onpause).toHaveBeenCalledOnce()

    el.emitEnded()
    expect(onend).toHaveBeenCalledOnce()

    sound.unload()
    expect(sound.state()).toBe('unloaded')
  })

  it('unlocks a 2-slot element pool in one gesture and reuses pooled elements across tracks', async () => {
    expect(isHtmlAudioPoolUnlocked()).toBe(false)
    await unlockHtmlAudioPool()
    expect(isHtmlAudioPoolUnlocked()).toBe(true)
    expect(FakeAudioElement.instances).toHaveLength(2)

    const [elA, elB] = FakeAudioElement.instances
    expect(elA.play).toHaveBeenCalledOnce()
    expect(elB.play).toHaveBeenCalledOnce()
    expect(elA.src).toBe('')
    expect(elB.src).toBe('')

    // Track 1 + preloaded Track 2 reuse the exact two unlocked elements
    const first = createHtmlAudioSound({ src: ['https://audio.example.test/1.mp3'] })
    const second = createHtmlAudioSound({ src: ['https://audio.example.test/2.mp3'] })
    expect(FakeAudioElement.instances).toHaveLength(2)

    // Unloading Track 1 returns its element to the pool for Track 3
    first.unload()
    const third = createHtmlAudioSound({ src: ['https://audio.example.test/3.mp3'] })
    expect(FakeAudioElement.instances).toHaveLength(2)

    second.unload()
    third.unload()
  })

  it('does not recycle an element claimed for WebAudio MediaElementAudioSource analysis', async () => {
    await unlockHtmlAudioPool()
    expect(FakeAudioElement.instances).toHaveLength(2)

    const sameOrigin = createHtmlAudioSound({ src: ['https://self.example.test/same-origin.mp3'] })
    const claimed = sameOrigin.claimMediaElementForAnalysis?.()
    expect(claimed).toBeTruthy()
    sameOrigin.unload()

    // Pool now has only 1 clean element left; claiming 2 sounds allocates 1 fresh element
    const a = createHtmlAudioSound({ src: ['https://cdn.example.test/a.mp3'] })
    const b = createHtmlAudioSound({ src: ['https://cdn.example.test/b.mp3'] })
    expect(FakeAudioElement.instances).toHaveLength(3)
    expect(a.claimMediaElementForAnalysis?.()).not.toBe(claimed)
    expect(b.claimMediaElementForAnalysis?.()).not.toBe(claimed)
    a.unload()
    b.unload()
  })

  it('ignores AbortError when paused before play() settles, and recovers from autoplay NotAllowedError on user gesture', async () => {
    const onplayerror = vi.fn()
    const onunlock = vi.fn()
    const sound = createHtmlAudioSound({
      src: ['https://audio.example.test/track.mp3'],
      onplayerror,
    })
    const el = FakeAudioElement.instances[0]
    el.emitCanPlay()

    // 1. AbortError from immediate pause() must not fire onplayerror
    let rejectPlay!: (reason?: unknown) => void
    el.play.mockImplementationOnce(() => new Promise<void>((_, reject) => {
      rejectPlay = reject
    }))
    const id = sound.play()
    sound.pause(id)
    rejectPlay(Object.assign(new Error('The play() request was interrupted'), { name: 'AbortError' }))
    await Promise.resolve()
    expect(onplayerror).not.toHaveBeenCalled()

    // 2. Real NotAllowedError triggers onplayerror and fires once('unlock') synchronously on next click
    el.play.mockImplementationOnce(() =>
      Promise.reject(Object.assign(new Error('Autoplay blocked'), { name: 'NotAllowedError' })),
    )
    sound.play(id)
    await Promise.resolve()
    expect(onplayerror).toHaveBeenCalledOnce()
    expect(sound.playing(id)).toBe(false)

    sound.once('unlock', onunlock)
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onunlock).toHaveBeenCalledExactlyOnceWith(id)

    sound.unload()
  })

  it('detaches listeners on unload so subsequent media events are ignored', () => {
    const onloaderror = vi.fn()
    const onend = vi.fn()
    const sound = createHtmlAudioSound({
      src: ['https://audio.example.test/track.mp3'],
      onloaderror,
      onend,
    })
    const el = FakeAudioElement.instances[0]
    sound.unload()

    el.emitError()
    el.emitEnded()
    expect(onloaderror).not.toHaveBeenCalled()
    expect(onend).not.toHaveBeenCalled()
  })
})
