import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MiniAppSDK } from '@discourse-mini-app/sdk'
import type { Track } from '@music-together/shared'
import type { PlaybackSoundOptions } from '../../../client/src/lib/PlaybackSound.ts'
import type { MappAudioEngineOptions, MappAudioEngineSnapshot } from './MappAudioEngine.ts'
import { createMappPlaybackSoundFactory } from './MappPlaybackSoundFactory.ts'

const mocks = vi.hoisted(() => ({ construct: vi.fn() }))
vi.mock('./MappAudioEngine.ts', () => ({ MappAudioEngine: mocks.construct }))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
async function flush() {
  for (let i = 0; i < 8; ++i) await Promise.resolve()
}
const track = (id = 'netease:1') => ({ id, streamUrl: 'https://unused.invalid/private' }) as Track
const callbacks = (): PlaybackSoundOptions => ({
  src: ['https://unused.invalid/source'],
  onload: vi.fn(),
  onloaderror: vi.fn(),
  onplay: vi.fn(),
  onplayerror: vi.fn(),
  onpause: vi.fn(),
  onend: vi.fn(),
})

function environment(mode?: 'bytes' | 'stream') {
  let observe: MappAudioEngineOptions['onChange']
  let volume = 0.12
  let rate = 1
  const snapshot: MappAudioEngineSnapshot = {
    trackId: 'netease:1',
    loading: false,
    errorCode: null,
    audio: { status: 'ready', position: 3, duration: 42, contextState: 'running' },
  }
  const emit = () => observe?.(snapshot)
  const engine = {
    snapshot: vi.fn(() => snapshot),
    loadRoomTrack: vi.fn(async (_input: { roomId: string; trackId: string; mode: 'bytes' | 'stream' }) => true),
    play: vi.fn(async () => {
      snapshot.audio.status = 'playing'
      emit()
      return true
    }),
    pause: vi.fn(() => {
      snapshot.audio.status = 'paused'
      emit()
    }),
    seek: vi.fn((position: number) => {
      snapshot.audio.position = position
      if (position === snapshot.audio.duration) snapshot.audio.status = 'ended'
      emit()
    }),
    getVolume: vi.fn(() => volume),
    setVolume: vi.fn((value: number) => {
      volume = value
      emit()
    }),
    getPlaybackRate: vi.fn(() => rate),
    setPlaybackRate: vi.fn((value: number) => {
      rate = value
      emit()
    }),
    unlock: vi.fn(async () => {
      emit()
      return true
    }),
    unload: vi.fn(() => {
      snapshot.audio.status = 'empty'
      emit()
    }),
    dispose: vi.fn(async () => {}),
  }
  mocks.construct.mockImplementation(function (input: MappAudioEngineOptions) {
    observe = input.onChange
    return engine
  })
  const sdk = {} as MiniAppSDK
  const getRoomId = vi.fn<() => string | null>(() => 'AB12_-')
  const createContext = vi.fn<() => AudioContext>()
  const factory = createMappPlaybackSoundFactory({ sdk, getRoomId, mode, createContext })
  return { factory, engine, snapshot, emit, sdk, getRoomId, createContext }
}

beforeEach(() => {
  mocks.construct.mockReset()
})

describe('MappPlaybackSoundFactory shared engine handles', () => {
  it('starts loading immediately, reports loaded asynchronously and never autoplays', async () => {
    const f = environment()
    const options = callbacks()
    const sound = f.factory.create(track(), options)
    expect(sound.state()).toBe('loading')
    expect(options.onload).not.toHaveBeenCalled()
    expect(f.factory.allowLoadRetry).toBe(false)
    expect(f.factory.supportsHtml5Analysis).toBe(false)
    await Promise.resolve()
    expect(sound.state()).toBe('loaded')
    expect(options.onload).not.toHaveBeenCalled()
    await flush()
    expect(options.onload).toHaveBeenCalledOnce()
    expect(f.engine.play).not.toHaveBeenCalled()
    expect(sound.duration()).toBe(42)
  })

  it('queues a seek during loading and does not abort loading when paused', async () => {
    const f = environment()
    const load = deferred<boolean>()
    f.engine.loadRoomTrack.mockReturnValueOnce(load.promise)
    const options = callbacks()
    const sound = f.factory.create(track(), options)
    sound.seek(9)
    sound.pause()
    expect(sound.seek()).toBe(9)
    expect(f.engine.seek).not.toHaveBeenCalled()
    expect(f.engine.pause).not.toHaveBeenCalled()
    expect(f.engine.unload).not.toHaveBeenCalled()
    load.resolve(true)
    await flush()
    expect(sound.state()).toBe('loaded')
    expect(f.engine.seek).toHaveBeenCalledExactlyOnceWith(9)
    expect(options.onload).toHaveBeenCalledOnce()
    expect(options.onloaderror).not.toHaveBeenCalled()
    expect(f.engine.play).not.toHaveBeenCalled()
  })

  it('delivers load readiness even when a seek supersedes a pending play operation', async () => {
    const f = environment()
    const options = callbacks()
    const sound = f.factory.create(track(), options)
    await Promise.resolve()
    expect(sound.state()).toBe('loaded')
    expect(options.onload).not.toHaveBeenCalled()
    sound.seek(6)
    await flush()
    expect(options.onload).toHaveBeenCalledOnce()
    expect(options.onloaderror).not.toHaveBeenCalled()
  })

  it.each([undefined, 'bytes'] as const)('passes identifiers and only the selected mode (%s)', async (mode) => {
    const f = environment(mode)
    const options = callbacks()
    Object.defineProperty(options, 'src', {
      get() {
        throw new Error('must not read source')
      },
    })
    const input = track()
    Object.defineProperty(input, 'streamUrl', {
      get() {
        throw new Error('must not read URL')
      },
    })
    f.factory.create(input, options)
    await flush()
    expect(f.engine.loadRoomTrack).toHaveBeenCalledExactlyOnceWith({
      roomId: 'AB12_-',
      trackId: 'netease:1',
      mode: mode ?? 'stream',
    })
    expect(mocks.construct).toHaveBeenCalledExactlyOnceWith({
      sdk: f.sdk,
      createContext: f.createContext,
      onChange: expect.any(Function),
    })
    expect(f.getRoomId).toHaveBeenCalledOnce()
  })

  it('returns a stable ID before asynchronous onplay and late once registration', async () => {
    const f = environment()
    const options = callbacks()
    const sound = f.factory.create(track(), options)
    await flush()
    let savedId: number | undefined
    const listener = vi.fn((id: number) => expect(id).toBe(savedId))
    savedId = sound.play()
    sound.once('play', listener)
    expect(options.onplay).not.toHaveBeenCalled()
    expect(listener).not.toHaveBeenCalled()
    await flush()
    expect(options.onplay).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledExactlyOnceWith(savedId)
    expect(sound.play(savedId)).toBe(savedId)
    await flush()
    expect(options.onplay).toHaveBeenCalledTimes(2)
    expect(listener).toHaveBeenCalledOnce()
  })

  it.each(['pause', 'seek', 'unload'] as const)('%s cancels a pending play and pending listeners', async (action) => {
    const f = environment()
    const options = callbacks()
    const sound = f.factory.create(track(), options)
    await flush()
    const pending = deferred<boolean>()
    f.engine.play.mockReturnValueOnce(pending.promise)
    const listener = vi.fn()
    sound.play()
    sound.once('play', listener)
    if (action === 'seek') sound.seek(5)
    else sound[action]()
    pending.resolve(true)
    await flush()
    expect(options.onplay).not.toHaveBeenCalled()
    expect(options.onplayerror).not.toHaveBeenCalled()
    expect(listener).not.toHaveBeenCalled()
    if (action !== 'unload') {
      sound.play()
      await flush()
      expect(listener).not.toHaveBeenCalled()
    }
  })

  it('invalidates an already queued play event before it dispatches', async () => {
    const f = environment()
    const options = callbacks()
    const sound = f.factory.create(track(), options)
    await flush()
    const listener = vi.fn()
    sound.play()
    sound.once('play', listener)
    await Promise.resolve()
    sound.pause()
    expect(options.onpause).not.toHaveBeenCalled()
    await flush()
    expect(options.onplay).not.toHaveBeenCalled()
    expect(listener).not.toHaveBeenCalled()
    expect(options.onpause).toHaveBeenCalledOnce()
    expect(f.engine.pause).toHaveBeenCalledOnce()
  })

  it.each(['resolve', 'reject'] as const)(
    'ignores late old-owner load %s and old handle operations',
    async (outcome) => {
      const f = environment()
      const pending = deferred<boolean>()
      f.engine.loadRoomTrack.mockReturnValueOnce(pending.promise)
      const oldOptions = callbacks()
      const old = f.factory.create(track('old'), oldOptions)
      const freshOptions = callbacks()
      const fresh = f.factory.create(track('new'), freshOptions)
      await flush()
      if (outcome === 'resolve') pending.resolve(true)
      else pending.reject(new Error('private source diagnostic'))
      await flush()
      expect(old.state()).toBe('unloaded')
      expect(fresh.state()).toBe('loaded')
      expect(oldOptions.onload).not.toHaveBeenCalled()
      expect(oldOptions.onloaderror).not.toHaveBeenCalled()
      expect(freshOptions.onload).toHaveBeenCalledOnce()
      old.unload()
      old.pause()
      old.seek(4)
      old.rate(2)
      old.volume(1)
      old.play()
      expect(f.engine.unload).toHaveBeenCalledOnce()
      expect(f.engine.pause).not.toHaveBeenCalled()
      expect(f.engine.seek).not.toHaveBeenCalled()
      expect(f.engine.play).not.toHaveBeenCalled()
      expect(old.playing()).toBe(false)
      expect(old.duration()).toBe(0)
      expect(old.seek()).toBe(0)
      expect(old.rate()).toBe(1)
      expect(mocks.construct).toHaveBeenCalledOnce()
      expect(f.engine.dispose).not.toHaveBeenCalled()
    },
  )

  it('suppresses a queued old load event when the next owner replaces it', async () => {
    const f = environment()
    const options = callbacks()
    f.factory.create(track('old'), options)
    await Promise.resolve()
    const freshOptions = callbacks()
    f.factory.create(track('new'), freshOptions)
    await flush()
    expect(options.onload).not.toHaveBeenCalled()
    expect(freshOptions.onload).toHaveBeenCalledOnce()
  })

  it.each(['newTrack', 'dispose'] as const)('invalidates late old play failures after %s', async (action) => {
    const f = environment()
    const options = callbacks()
    const sound = f.factory.create(track(), options)
    await flush()
    const pending = deferred<boolean>()
    f.engine.play.mockReturnValueOnce(pending.promise)
    sound.play()
    const listener = vi.fn()
    sound.once('play', listener)
    if (action === 'newTrack') f.factory.create(track('new'), callbacks())
    else void f.factory.dispose()
    pending.reject({ url: 'private' })
    await flush()
    expect(options.onplayerror).not.toHaveBeenCalled()
    expect(options.onplay).not.toHaveBeenCalled()
    expect(listener).not.toHaveBeenCalled()
  })

  it.each([false, 'reject', 'throw'] as const)(
    'reports a fixed asynchronous terminal load error (%s)',
    async (failure) => {
      const f = environment()
      const options = callbacks()
      if (failure === false) f.engine.loadRoomTrack.mockResolvedValueOnce(false)
      else if (failure === 'reject') f.engine.loadRoomTrack.mockRejectedValueOnce({ token: 'private' })
      else
        f.engine.loadRoomTrack.mockImplementationOnce(() => {
          throw { url: 'private' }
        })
      const sound = f.factory.create(track(), options)
      expect(options.onloaderror).not.toHaveBeenCalled()
      expect(sound.state()).toBe('loading')
      await flush()
      expect(sound.state()).toBe('unloaded')
      expect(options.onloaderror).toHaveBeenCalledExactlyOnceWith(expect.any(Number), 'AUDIO_LOAD_FAILED')
      expect(options.onload).not.toHaveBeenCalled()
      sound.load()
      sound.load()
      expect(f.engine.loadRoomTrack).toHaveBeenCalledOnce()
      sound.unload()
      sound.unload()
      expect(f.engine.unload).toHaveBeenCalledOnce()
    },
  )

  it('handles a missing room without loading, and unload cancels queued failures', async () => {
    const f = environment()
    f.getRoomId.mockReturnValue(null)
    const options = callbacks()
    const sound = f.factory.create(track(), options)
    sound.unload()
    await flush()
    expect(f.engine.loadRoomTrack).not.toHaveBeenCalled()
    expect(options.onloaderror).not.toHaveBeenCalled()
  })

  it('reads measured position and delegates rate and volume, resetting each new track', async () => {
    const f = environment()
    const sound = f.factory.create(track(), { src: [], volume: 0.7 })
    await flush()
    expect(f.engine.setPlaybackRate).toHaveBeenLastCalledWith(1)
    expect(f.engine.setVolume).toHaveBeenLastCalledWith(0.7)
    sound.rate(1.25)
    sound.volume(0.4)
    expect(sound.rate()).toBe(1.25)
    expect(f.engine.getVolume()).toBe(0.4)
    const id = sound.play()
    await flush()
    expect(sound.seek(undefined, id)).toBe(3)
    expect(f.engine.seek).not.toHaveBeenCalled()
    sound.seek(id)
    expect(f.engine.seek).toHaveBeenLastCalledWith(id)
    sound.seek(8, id)
    expect(f.engine.seek).toHaveBeenLastCalledWith(8)
    expect(sound.seek(undefined, id)).toBe(8)
    expect(sound.playing(id)).toBe(true)
    f.snapshot.audio.status = 'scheduled'
    expect(sound.playing(id)).toBe(true)
    f.snapshot.audio.status = 'paused'
    expect(sound.playing(id)).toBe(false)
    f.factory.create(track('new'), { src: [] })
    expect(f.engine.setPlaybackRate).toHaveBeenLastCalledWith(1)
    expect(f.engine.setVolume).toHaveBeenLastCalledWith(0.12)
    expect(f.engine.dispose).not.toHaveBeenCalled()
  })

  it('does not let mismatched sound IDs control or read the current track', async () => {
    const f = environment()
    const sound = f.factory.create(track(), { src: [] })
    await flush()
    const id = sound.play()
    await flush()
    sound.pause(id + 1)
    sound.seek(9, id + 1)
    sound.play(id + 1)
    expect(sound.playing(id + 1)).toBe(false)
    expect(sound.seek(undefined, id + 1)).toBe(0)
    expect(f.engine.pause).not.toHaveBeenCalled()
    expect(f.engine.seek).not.toHaveBeenCalled()
    expect(f.engine.play).toHaveBeenCalledOnce()
  })

  it('only reports actual natural ends once and never synthesizes lifecycle events from snapshots', async () => {
    const f = environment()
    const options = callbacks()
    const sound = f.factory.create(track(), options)
    await flush()
    f.snapshot.audio.status = 'ended'
    f.emit()
    await flush()
    expect(options.onend).not.toHaveBeenCalled()
    sound.play()
    await flush()
    f.snapshot.audio.status = 'ended'
    f.emit()
    f.emit()
    expect(options.onend).not.toHaveBeenCalled()
    await flush()
    f.emit()
    await flush()
    expect(options.onend).toHaveBeenCalledOnce()
    expect(options.onload).toHaveBeenCalledOnce()
    expect(options.onplay).toHaveBeenCalledOnce()
    expect(options.onpause).not.toHaveBeenCalled()
  })

  it.each(['pause', 'seek', 'newTrack', 'unload', 'dispose'] as const)(
    'cancels queued natural end after %s',
    async (action) => {
      const f = environment()
      const options = callbacks()
      const sound = f.factory.create(track(), options)
      await flush()
      sound.play()
      await flush()
      f.snapshot.audio.status = 'ended'
      f.emit()
      if (action === 'seek') sound.seek(4)
      else if (action === 'newTrack') f.factory.create(track('new'), callbacks())
      else if (action === 'dispose') void f.factory.dispose()
      else sound[action]()
      await flush()
      expect(options.onend).not.toHaveBeenCalled()
    },
  )

  it('ignores seek-to-end notifications and still permits natural ending after an active seek', async () => {
    const f = environment()
    const options = callbacks()
    const sound = f.factory.create(track(), options)
    await flush()
    sound.play()
    await flush()
    sound.seek(42)
    await flush()
    expect(options.onend).not.toHaveBeenCalled()
    sound.play()
    await flush()
    sound.seek(10)
    f.snapshot.audio.status = 'ended'
    f.emit()
    await flush()
    expect(options.onend).toHaveBeenCalledOnce()
  })

  it.each([false, 'reject'] as const)('reports fixed asynchronous play errors (%s)', async (failure) => {
    const f = environment()
    const options = callbacks()
    const sound = f.factory.create(track(), options)
    await flush()
    if (failure === false) f.engine.play.mockResolvedValueOnce(false)
    else f.engine.play.mockRejectedValueOnce({ sdk: 'private' })
    const id = sound.play()
    const listener = vi.fn()
    sound.once('play', listener)
    expect(options.onplayerror).not.toHaveBeenCalled()
    await flush()
    expect(options.onplayerror).toHaveBeenCalledExactlyOnceWith(id, 'AUDIO_PLAY_FAILED')
    expect(options.onplay).not.toHaveBeenCalled()
    sound.play()
    await flush()
    expect(listener).not.toHaveBeenCalled()
  })

  it('validates owner again between onplay and every once listener', async () => {
    const f = environment()
    const options = callbacks()
    const sound = f.factory.create(track(), options)
    await flush()
    const first = vi.fn(() => f.factory.create(track('new'), callbacks()))
    const second = vi.fn()
    sound.once('play', first)
    sound.once('play', second)
    sound.play()
    await flush()
    expect(options.onplay).toHaveBeenCalledOnce()
    expect(first).toHaveBeenCalledOnce()
    expect(second).not.toHaveBeenCalled()
  })

  it('validates owner between onplay and its first once listener', async () => {
    const f = environment()
    const options = callbacks()
    options.onplay = () => {
      f.factory.create(track('new'), callbacks())
    }
    const sound = f.factory.create(track(), options)
    await flush()
    const listener = vi.fn()
    sound.once('play', listener)
    sound.play()
    await flush()
    expect(listener).not.toHaveBeenCalled()
  })

  it('unloads the current track idempotently while keeping its shared engine available', async () => {
    const f = environment()
    const options = callbacks()
    const first = f.factory.create(track('first'), options)
    await flush()
    const firstId = first.play()
    await flush()
    first.unload()
    first.unload()
    const second = f.factory.create(track('second'), callbacks())
    await flush()
    expect(second.play()).not.toBe(firstId)
    await flush()
    expect(f.engine.unload).toHaveBeenCalledOnce()
    expect(mocks.construct).toHaveBeenCalledOnce()
    expect(f.engine.dispose).not.toHaveBeenCalled()
  })

  it('calls unlock synchronously for the gesture and delivers pending listeners only once', async () => {
    const f = environment()
    const sound = f.factory.create(track(), callbacks())
    await flush()
    const listener = vi.fn()
    sound.once('unlock', listener)
    const pending = deferred<boolean>()
    f.engine.unlock.mockReturnValueOnce(pending.promise)
    const unlocking = f.factory.unlock()
    expect(f.engine.unlock).toHaveBeenCalledOnce()
    expect(listener).not.toHaveBeenCalled()
    pending.resolve(true)
    expect(await unlocking).toBe(true)
    await flush()
    expect(listener).toHaveBeenCalledExactlyOnceWith(expect.any(Number))
    await f.factory.unlock()
    await flush()
    expect(listener).toHaveBeenCalledOnce()
  })

  it.each([false, 'reject'] as const)('does not dispatch unlock on failure (%s)', async (failure) => {
    const f = environment()
    const sound = f.factory.create(track(), callbacks())
    await flush()
    const listener = vi.fn()
    sound.once('unlock', listener)
    if (failure === false) f.engine.unlock.mockResolvedValueOnce(false)
    else f.engine.unlock.mockRejectedValueOnce({ token: 'private' })
    expect(await f.factory.unlock()).toBe(false)
    await flush()
    expect(listener).not.toHaveBeenCalled()
    expect(await f.factory.unlock()).toBe(true)
    await flush()
    expect(listener).toHaveBeenCalledOnce()
  })

  it.each(['unload', 'newTrack', 'dispose'] as const)('does not deliver an old unlock after %s', async (action) => {
    const f = environment()
    const sound = f.factory.create(track(), callbacks())
    await flush()
    const listener = vi.fn()
    const freshListener = vi.fn()
    sound.once('unlock', listener)
    const pending = deferred<boolean>()
    f.engine.unlock.mockReturnValueOnce(pending.promise)
    const unlocking = f.factory.unlock()
    if (action === 'unload') sound.unload()
    else if (action === 'dispose') void f.factory.dispose()
    else f.factory.create(track('new'), callbacks()).once('unlock', freshListener)
    pending.resolve(true)
    await unlocking
    await flush()
    expect(listener).not.toHaveBeenCalled()
    expect(freshListener).not.toHaveBeenCalled()
  })

  it('closes the one shared engine once and ignores all late work after dispose', async () => {
    const f = environment()
    const loading = deferred<boolean>()
    f.engine.loadRoomTrack.mockReturnValueOnce(loading.promise)
    const options = callbacks()
    const sound = f.factory.create(track(), options)
    const disposal = deferred<void>()
    f.engine.dispose.mockReturnValueOnce(disposal.promise)
    const first = f.factory.dispose()
    expect(f.factory.dispose()).toBe(first)
    expect(f.engine.dispose).toHaveBeenCalledOnce()
    loading.resolve(true)
    await flush()
    expect(sound.state()).toBe('unloaded')
    expect(options.onload).not.toHaveBeenCalled()
    expect(options.onloaderror).not.toHaveBeenCalled()
    const dead = f.factory.create(track('new'), callbacks())
    expect(dead.state()).toBe('unloaded')
    dead.play()
    dead.pause()
    dead.seek(1)
    dead.volume(1)
    dead.rate(2)
    dead.unload()
    expect(await f.factory.unlock()).toBe(false)
    expect(f.engine.loadRoomTrack).toHaveBeenCalledOnce()
    expect(f.engine.play).not.toHaveBeenCalled()
    expect(f.engine.unload).not.toHaveBeenCalled()
    expect(mocks.construct).toHaveBeenCalledOnce()
    disposal.resolve()
    await first
  })
})
