import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HttpRequestOptions, MiniAppSDK } from '@discourse-mini-app/sdk'
import { WebAudioPlayer } from './WebAudioPlayer.ts'
import { MappAudioEngine, type MappAudioEngineSnapshot } from './MappAudioEngine.ts'

const bytes = new Uint8Array([255, 251, 144, 100, 1, 2, 3, 4])
const response = { status: 200, headers: { 'content-type': 'audio/mpeg' }, body: bytes }
const input = (trackId = 'netease:1') => ({ roomId: 'AB12_-', trackId, mode: 'bytes' as const })
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
function environment(
  options: { audio?: boolean; network?: boolean; onChange?: (value: MappAudioEngineSnapshot) => void } = {},
) {
  const sources: ReturnType<typeof createSource>[] = []
  function createSource() {
    return {
      buffer: null as AudioBuffer | null,
      loop: false,
      playbackRate: { value: 1 },
      onended: null as (() => void) | null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }
  }
  const context = Object.assign(new EventTarget(), {
    currentTime: 10,
    state: 'suspended' as AudioContextState,
    destination: {},
    createGain: vi.fn(() => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() })),
    createBufferSource: vi.fn(() => {
      const source = createSource()
      sources.push(source)
      return source
    }),
    decodeAudioData: vi.fn(async (_bytes: ArrayBuffer) => ({ duration: 8 }) as AudioBuffer),
    resume: vi.fn(async () => {
      context.state = 'running'
    }),
    close: vi.fn(async () => {
      context.state = 'closed'
    }),
  })
  const request = vi.fn(async (_endpoint: string, _options?: HttpRequestOptions<'bytes'>) => response)
  const has = vi.fn((permission: string) =>
    permission === 'audio.webAudio' ? options.audio !== false : options.network !== false,
  )
  const sdk = { http: { request }, permissions: { has } } as unknown as MiniAppSDK
  const createContext = vi.fn(() => context as unknown as AudioContext)
  const engine = new MappAudioEngine({ sdk, createContext, onChange: options.onChange })
  return { engine, context, sources, request, sdk, createContext, has }
}

// Global prototype spies are restored; every context and SDK in this suite is mocked.
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('MappAudioEngine thin WebAudioPlayer adapter', () => {
  it('releases a track on unload and reuses the unlocked context for the next track', async () => {
    const f = environment()
    await f.engine.loadRoomTrack(input('first'))
    await f.engine.play()
    f.engine.unload()
    expect(f.engine.snapshot()).toMatchObject({
      trackId: null,
      loading: false,
      errorCode: null,
      audio: { status: 'empty', duration: 0 },
    })
    expect(f.sources[0].stop).toHaveBeenCalledOnce()
    expect(f.context.close).not.toHaveBeenCalled()
    expect(await f.engine.loadRoomTrack(input('second'))).toBe(true)
    expect(f.createContext).toHaveBeenCalledOnce()
    f.has.mockReturnValue(false)
    expect(() => f.engine.unload()).not.toThrow()
    expect(f.engine.snapshot().trackId).toBeNull()
    await f.engine.dispose()
    f.engine.unload()
    expect(f.context.close).toHaveBeenCalledOnce()
  })

  it('cancels a pending SDK load on unload and ignores its late result', async () => {
    const f = environment()
    const late = deferred<typeof response>()
    f.request.mockReturnValueOnce(late.promise)
    const pending = f.engine.loadRoomTrack(input())
    f.engine.unload()
    expect(await pending).toBe(false)
    late.resolve(response)
    await Promise.resolve()
    expect(f.engine.snapshot()).toMatchObject({
      trackId: null,
      loading: false,
      errorCode: null,
      audio: { status: 'empty', duration: 0 },
    })
    expect(f.context.decodeAudioData).not.toHaveBeenCalled()
    await f.engine.dispose()
  })

  it('delegates volume and rate metadata without loading, requesting or initializing audio', async () => {
    const getVolume = vi.spyOn(WebAudioPlayer.prototype, 'getVolume')
    const setVolume = vi.spyOn(WebAudioPlayer.prototype, 'setVolume')
    const getRate = vi.spyOn(WebAudioPlayer.prototype, 'getPlaybackRate')
    const setRate = vi.spyOn(WebAudioPlayer.prototype, 'setPlaybackRate')
    const f = environment()
    expect(f.engine.getVolume()).toBe(0.12)
    expect(f.engine.getPlaybackRate()).toBe(1)
    f.engine.setVolume(0.8)
    f.engine.setPlaybackRate(1.5)
    expect(setVolume).toHaveBeenCalledWith(0.8)
    expect(setRate).toHaveBeenCalledWith(1.5)
    expect(f.engine.getVolume()).toBe(0.8)
    expect(f.engine.getPlaybackRate()).toBe(1.5)
    expect(getVolume).toHaveBeenCalledTimes(2)
    expect(getRate).toHaveBeenCalledTimes(2)
    expect(f.createContext).not.toHaveBeenCalled()
    expect(f.request).not.toHaveBeenCalled()
    expect(f.sources).toHaveLength(0)
    await f.engine.loadRoomTrack(input())
    await f.engine.play()
    expect(f.context.createGain.mock.results[0].value.gain.value).toBe(0.8)
    expect(f.sources[0].playbackRate.value).toBe(1.5)
    f.context.currentTime = 12
    f.engine.setPlaybackRate(0.5)
    expect(f.engine.snapshot().audio.position).toBe(3)
    f.context.currentTime = 14
    expect(f.engine.snapshot().audio.position).toBe(4)
    expect(f.sources).toHaveLength(1)
    expect(f.sources[0].stop).not.toHaveBeenCalled()
    await f.engine.dispose()
  })

  it('checks audio permission on every setter while allowing metadata reads', async () => {
    const setVolume = vi.spyOn(WebAudioPlayer.prototype, 'setVolume')
    const setRate = vi.spyOn(WebAudioPlayer.prototype, 'setPlaybackRate')
    const f = environment({ audio: false })
    expect(() => f.engine.setVolume(0.8)).toThrow('AUDIO_PERMISSION_REQUIRED')
    expect(() => f.engine.setPlaybackRate(1.5)).toThrow('AUDIO_PERMISSION_REQUIRED')
    expect(setVolume).not.toHaveBeenCalled()
    expect(setRate).not.toHaveBeenCalled()
    expect(f.engine.getVolume()).toBe(0.12)
    expect(f.engine.getPlaybackRate()).toBe(1)
    f.has.mockReturnValue(true)
    f.engine.setVolume(0.8)
    f.engine.setPlaybackRate(1.5)
    f.has.mockReturnValue(false)
    expect(() => f.engine.setVolume(0)).toThrow('AUDIO_PERMISSION_REQUIRED')
    expect(() => f.engine.setPlaybackRate(2)).toThrow('AUDIO_PERMISSION_REQUIRED')
    expect(f.engine.getVolume()).toBe(0.8)
    expect(f.engine.getPlaybackRate()).toBe(1.5)
    expect(f.createContext).not.toHaveBeenCalled()
    expect(f.request).not.toHaveBeenCalled()
    await f.engine.dispose()
  })

  it('maps invalid inputs to fixed errors without changing stored settings', async () => {
    const changes = vi.fn()
    const f = environment({ onChange: changes })
    f.engine.setVolume(0.8)
    f.engine.setPlaybackRate(1.5)
    expect(() => f.engine.setVolume(Number.NaN)).toThrow(
      expect.objectContaining({ code: 'AUDIO_VOLUME_FAILED', message: 'AUDIO_VOLUME_FAILED' }),
    )
    expect(f.engine.snapshot().errorCode).toBe('AUDIO_VOLUME_FAILED')
    expect(() => f.engine.setPlaybackRate(3)).toThrow(
      expect.objectContaining({ code: 'AUDIO_RATE_FAILED', message: 'AUDIO_RATE_FAILED' }),
    )
    expect(f.engine.snapshot().errorCode).toBe('AUDIO_RATE_FAILED')
    expect(changes.mock.calls.at(-1)![0].errorCode).toBe('AUDIO_RATE_FAILED')
    expect(f.engine.getVolume()).toBe(0.8)
    expect(f.engine.getPlaybackRate()).toBe(1.5)
    expect(f.createContext).not.toHaveBeenCalled()
    await f.engine.dispose()
  })

  it('sanitizes native setter errors rather than exposing private diagnostics', async () => {
    const f = environment()
    vi.spyOn(WebAudioPlayer.prototype, 'setVolume').mockImplementationOnce(() => {
      throw new Error('private volume diagnostic')
    })
    vi.spyOn(WebAudioPlayer.prototype, 'setPlaybackRate').mockImplementationOnce(() => {
      throw new Error('private rate diagnostic')
    })
    expect(() => f.engine.setVolume(0.8)).toThrow(
      expect.objectContaining({ code: 'AUDIO_VOLUME_FAILED', message: 'AUDIO_VOLUME_FAILED' }),
    )
    expect(f.engine.snapshot().errorCode).toBe('AUDIO_VOLUME_FAILED')
    expect(() => f.engine.setPlaybackRate(1.5)).toThrow(
      expect.objectContaining({ code: 'AUDIO_RATE_FAILED', message: 'AUDIO_RATE_FAILED' }),
    )
    expect(f.engine.snapshot().errorCode).toBe('AUDIO_RATE_FAILED')
    expect(f.engine.getVolume()).toBe(0.12)
    expect(f.engine.getPlaybackRate()).toBe(1)
    await f.engine.dispose()
  })

  it('allows only metadata reads after disposal and never reinitializes audio', async () => {
    const changes = vi.fn()
    const f = environment({ onChange: changes })
    f.engine.setVolume(0.8)
    f.engine.setPlaybackRate(1.5)
    await f.engine.dispose()
    const count = changes.mock.calls.length
    expect(() => f.engine.setVolume(0)).toThrow('DISPOSED')
    expect(() => f.engine.setPlaybackRate(2)).toThrow('DISPOSED')
    expect(f.engine.getVolume()).toBe(0.8)
    expect(f.engine.getPlaybackRate()).toBe(1.5)
    expect(f.engine.snapshot().errorCode).toBe('DISPOSED')
    expect(changes).toHaveBeenCalledTimes(count)
    expect(f.createContext).not.toHaveBeenCalled()
    expect(f.request).not.toHaveBeenCalled()
  })

  it('uses the original load and never autoplays, exposing only the public snapshot', async () => {
    const load = vi.spyOn(WebAudioPlayer.prototype, 'load')
    const changes = vi.fn()
    const f = environment({ onChange: changes })
    expect(f.engine.snapshot()).toEqual({
      trackId: null,
      loading: false,
      errorCode: null,
      audio: {
        status: 'empty',
        position: 0,
        duration: 0,
        contextState: 'not-created',
      },
    })
    expect(await f.engine.loadRoomTrack(input())).toBe(true)
    expect(load).toHaveBeenCalledOnce()
    expect(load).toHaveBeenCalledWith(bytes)
    expect(f.engine.snapshot()).toEqual({
      trackId: 'netease:1',
      loading: false,
      errorCode: null,
      audio: {
        status: 'ready',
        position: 0,
        duration: 8,
        contextState: 'suspended',
      },
    })
    expect(f.context.decodeAudioData.mock.calls[0][0]).not.toBe(bytes.buffer)
    expect(f.sources).toHaveLength(0)
    expect(f.context.resume).not.toHaveBeenCalled()
    expect(f.request).toHaveBeenCalledWith(
      'roomAudio',
      expect.objectContaining({ query: { roomId: 'AB12_-', trackId: 'netease:1' } }),
    )
    expect(Object.keys(changes.mock.calls.at(-1)![0]).sort()).toEqual(['audio', 'errorCode', 'loading', 'trackId'])
    await f.engine.dispose()
  })

  it('delegates play(delay,getPosition), pause, seek and unlock to the existing audio clock', async () => {
    const play = vi.spyOn(WebAudioPlayer.prototype, 'play')
    const pause = vi.spyOn(WebAudioPlayer.prototype, 'pause')
    const seek = vi.spyOn(WebAudioPlayer.prototype, 'seek')
    const unlock = vi.spyOn(WebAudioPlayer.prototype, 'unlock')
    const f = environment()
    await f.engine.loadRoomTrack(input())
    const unlocking = f.engine.unlock()
    expect(f.context.resume).toHaveBeenCalledOnce()
    expect(await unlocking).toBe(true)
    expect(unlock).toHaveBeenCalledOnce()
    expect(f.sources).toHaveLength(0)
    let position = 1
    const getPosition = vi.fn(() => position)
    const playing = f.engine.play(1, getPosition)
    position = 4
    expect(await playing).toBe(true)
    expect(play).toHaveBeenCalledWith(1, getPosition)
    expect(f.sources[0].start).toHaveBeenCalledWith(11, 4)
    f.engine.seek(6)
    expect(seek).toHaveBeenCalledWith(6)
    expect(f.sources[1].start).toHaveBeenCalledWith(11, 6)
    f.context.currentTime = 12
    f.engine.pause()
    expect(pause).toHaveBeenCalled()
    expect(f.sources[1].stop).toHaveBeenCalledOnce()
    expect(f.engine.snapshot().audio).toMatchObject({ status: 'paused', position: 7 })
    await f.engine.dispose()
  })

  it('aborts an old SDK load so a late result cannot overwrite a new track', async () => {
    const f = environment()
    const late = deferred<typeof response>()
    let oldSignal: AbortSignal | undefined
    f.request.mockImplementationOnce((_endpoint, options) => {
      oldSignal = options?.signal
      return late.promise
    })
    const first = f.engine.loadRoomTrack(input('old'))
    expect(f.engine.snapshot().loading).toBe(true)
    expect(await f.engine.loadRoomTrack(input('new'))).toBe(true)
    expect(await first).toBe(false)
    expect(oldSignal?.aborted).toBe(true)
    late.resolve(response)
    await Promise.resolve()
    await Promise.resolve()
    expect(f.engine.snapshot()).toMatchObject({ trackId: 'new', loading: false, errorCode: null })
    expect(f.context.decodeAudioData).toHaveBeenCalledOnce()
    await f.engine.dispose()
  })

  it.each(['resolve', 'reject'] as const)(
    'invalidates an old native decode before fetching the next track (%s)',
    async (outcome) => {
      const f = environment()
      const decoding = deferred<void>()
      const oldDecode = deferred<AudioBuffer>()
      f.context.decodeAudioData.mockImplementationOnce(() => {
        decoding.resolve()
        return oldDecode.promise
      })
      const first = f.engine.loadRoomTrack(input('old'))
      await decoding.promise
      // The next transfer has not completed yet: cancelPendingOperations must already invalidate old decode.
      const next = deferred<typeof response>()
      f.request.mockReturnValueOnce(next.promise)
      const second = f.engine.loadRoomTrack(input('new'))
      expect(await first).toBe(false)
      if (outcome === 'resolve') oldDecode.resolve({ duration: 99 } as AudioBuffer)
      else oldDecode.reject(new Error('private decode details'))
      await Promise.resolve()
      await Promise.resolve()
      expect(f.engine.snapshot()).toMatchObject({
        trackId: null,
        loading: true,
        errorCode: null,
        audio: { duration: 0 },
      })
      next.resolve(response)
      expect(await second).toBe(true)
      expect(f.engine.snapshot()).toMatchObject({ trackId: 'new', audio: { duration: 8 } })
      await f.engine.dispose()
    },
  )

  it('cancel invalidates both the fetch and decode without waiting for their native completion', async () => {
    const f = environment()
    const cancelPending = vi.spyOn(WebAudioPlayer.prototype, 'cancelPendingOperations')
    const late = deferred<typeof response>()
    f.request.mockReturnValueOnce(late.promise)
    const first = f.engine.loadRoomTrack(input())
    f.engine.cancel()
    expect(await first).toBe(false)
    expect(f.engine.snapshot()).toMatchObject({ trackId: null, loading: false, errorCode: 'ABORTED' })
    const decoding = deferred<void>()
    const native = deferred<AudioBuffer>()
    f.context.decodeAudioData.mockImplementationOnce(() => {
      decoding.resolve()
      return native.promise
    })
    const second = f.engine.loadRoomTrack(input('decode'))
    await decoding.promise
    f.engine.cancel()
    expect(await second).toBe(false)
    native.resolve({ duration: 99 } as AudioBuffer)
    late.resolve(response)
    await Promise.resolve()
    await Promise.resolve()
    expect(cancelPending).toHaveBeenCalledTimes(4)
    expect(f.engine.snapshot()).toMatchObject({ trackId: null, loading: false, audio: { duration: 0 } })
    await f.engine.dispose()
  })

  it('handles the caller abort during decode and pre-aborted requests', async () => {
    const f = environment()
    const pre = new AbortController()
    pre.abort()
    expect(await f.engine.loadRoomTrack({ ...input(), signal: pre.signal })).toBe(false)
    expect(f.request).not.toHaveBeenCalled()
    const started = deferred<void>()
    f.context.decodeAudioData.mockImplementationOnce(() => {
      started.resolve()
      return new Promise(() => {})
    })
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    const pending = f.engine.loadRoomTrack({ ...input(), signal: controller.signal })
    await started.promise
    controller.abort()
    expect(await pending).toBe(false)
    expect(f.engine.snapshot()).toMatchObject({ loading: false, errorCode: 'ABORTED' })
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
    await f.engine.dispose()
  })

  it('pause during pending decode terminates loading and never adopts late audio', async () => {
    const f = environment()
    const started = deferred<void>()
    const late = deferred<AudioBuffer>()
    f.context.decodeAudioData.mockImplementationOnce(() => {
      started.resolve()
      return late.promise
    })
    const pending = f.engine.loadRoomTrack(input())
    await started.promise
    f.engine.pause()
    expect(await pending).toBe(false)
    late.resolve({ duration: 99 } as AudioBuffer)
    await Promise.resolve()
    expect(f.engine.snapshot()).toMatchObject({ loading: false, trackId: null, audio: { duration: 0 } })
    await f.engine.dispose()
  })

  it.each(['audio', 'network'] as const)('checks %s permission in the responsible layer', async (permission) => {
    const f = environment({ [permission]: false })
    expect(await f.engine.loadRoomTrack(input())).toBe(false)
    expect(f.engine.snapshot().errorCode).toBe(
      permission === 'audio' ? 'AUDIO_PERMISSION_REQUIRED' : 'NETWORK_PERMISSION_REQUIRED',
    )
    expect(f.request).not.toHaveBeenCalled()
    expect(f.createContext).not.toHaveBeenCalled()
    await f.engine.dispose()
  })

  it('sanitizes transfer and decode failures, and does not play the prior track after a failed load', async () => {
    const f = environment()
    await f.engine.loadRoomTrack(input('first'))
    f.context.decodeAudioData.mockRejectedValueOnce(new Error('https://private.invalid/?token=secret'))
    expect(await f.engine.loadRoomTrack(input('second'))).toBe(false)
    expect(f.engine.snapshot()).toMatchObject({ trackId: null, loading: false, errorCode: 'AUDIO_DECODE_FAILED' })
    await expect(f.engine.play()).rejects.toMatchObject({ code: 'AUDIO_NOT_LOADED' })
    f.request.mockRejectedValueOnce({ code: 'SENSITIVE_DETAIL', message: 'secret' })
    expect(await f.engine.loadRoomTrack(input())).toBe(false)
    expect(f.engine.snapshot().errorCode).toBe('REQUEST_FAILED')
    await f.engine.dispose()
  })

  it('reports only fixed playback errors', async () => {
    const f = environment()
    await f.engine.loadRoomTrack(input())
    f.context.resume.mockRejectedValueOnce(new Error('private browser diagnostic'))
    await expect(f.engine.play()).rejects.toMatchObject({ code: 'AUDIO_PLAY_FAILED', message: 'AUDIO_PLAY_FAILED' })
    expect(f.engine.snapshot().errorCode).toBe('AUDIO_PLAY_FAILED')
    expect(() => f.engine.seek(Number.NaN)).toThrow('AUDIO_SEEK_FAILED')
    f.context.resume.mockRejectedValueOnce(new Error('private browser diagnostic'))
    await expect(f.engine.unlock()).rejects.toMatchObject({ code: 'AUDIO_UNLOCK_FAILED' })
    await f.engine.dispose()
  })

  it('stops old scheduled play/resume when a new load begins', async () => {
    const f = environment()
    await f.engine.loadRoomTrack(input('old'))
    const resume = deferred<void>()
    f.context.resume.mockReturnValueOnce(resume.promise)
    const playing = f.engine.play(1)
    await f.engine.loadRoomTrack(input('new'))
    resume.resolve()
    expect(await playing).toBe(false)
    expect(f.sources).toHaveLength(0)
    expect(f.engine.snapshot().trackId).toBe('new')
    await f.engine.dispose()
  })

  it.each(['fetch', 'decode'] as const)('disposes idempotently during %s and blocks late callbacks', async (phase) => {
    const changes = vi.fn()
    const f = environment({ onChange: changes })
    const started = deferred<void>()
    const lateRequest = deferred<typeof response>()
    const lateDecode = deferred<AudioBuffer>()
    if (phase === 'fetch') f.request.mockReturnValueOnce(lateRequest.promise)
    else
      f.context.decodeAudioData.mockImplementationOnce(() => {
        started.resolve()
        return lateDecode.promise
      })
    const pending = f.engine.loadRoomTrack(input())
    if (phase === 'decode') await started.promise
    const closing = f.engine.dispose()
    const count = changes.mock.calls.length
    expect(f.engine.dispose()).toBe(closing)
    await closing
    expect(await pending).toBe(false)
    lateRequest.resolve(response)
    lateDecode.resolve({ duration: 99 } as AudioBuffer)
    f.context.dispatchEvent(new Event('statechange'))
    await Promise.resolve()
    await Promise.resolve()
    expect(changes).toHaveBeenCalledTimes(count)
    expect(f.engine.snapshot()).toMatchObject({
      trackId: null,
      loading: false,
      errorCode: 'DISPOSED',
      audio: { status: 'closed', duration: 0 },
    })
    expect(f.context.close).toHaveBeenCalledTimes(phase === 'fetch' ? 0 : 1)
    expect(await f.engine.loadRoomTrack(input('later'))).toBe(false)
    await expect(f.engine.play()).rejects.toMatchObject({ code: 'DISPOSED' })
    expect(() => f.engine.pause()).toThrow('DISPOSED')
    expect(() => f.engine.seek(0)).toThrow('DISPOSED')
  })

  it('blocks playback resumed after disposal and tolerates reentrant cancellation', async () => {
    const f = environment()
    await f.engine.loadRoomTrack(input())
    const late = deferred<void>()
    f.context.resume.mockReturnValueOnce(late.promise)
    const playing = f.engine.play()
    await f.engine.dispose()
    late.resolve()
    expect(await playing).toBe(false)
    expect(f.sources).toHaveLength(0)

    const g = environment({
      onChange: (snapshot) => {
        if (snapshot.loading) g.engine.cancel()
      },
    })
    expect(await g.engine.loadRoomTrack(input())).toBe(false)
    expect(g.request).not.toHaveBeenCalled()
    expect(g.engine.snapshot()).toMatchObject({ loading: false, errorCode: 'ABORTED' })
    await g.engine.dispose()
  })
})

describe('MappAudioEngine preloading the announced next track', () => {
  const preload = (trackId: string) => ({ roomId: 'AB12_-', trackId, mode: 'bytes' as const })

  it('reads the bytes ahead of time and hands them to the load of that very track without another request', async () => {
    const f = environment()
    f.engine.preloadRoomTrack(preload('next'))
    await vi.waitFor(() => expect(f.request).toHaveBeenCalledOnce())
    expect(f.request.mock.calls[0][1]).toMatchObject({ query: { roomId: 'AB12_-', trackId: 'next' } })

    expect(await f.engine.loadRoomTrack(input('next'))).toBe(true)
    expect(f.request).toHaveBeenCalledOnce()
    expect(f.context.decodeAudioData).toHaveBeenCalledOnce()
    expect(f.engine.snapshot()).toMatchObject({ trackId: 'next', loading: false, errorCode: null })
    await f.engine.dispose()
  })

  it('takes over a transfer that is still running instead of starting a second one', async () => {
    const f = environment()
    const reply = deferred<typeof response>()
    f.request.mockReturnValueOnce(reply.promise)
    f.engine.preloadRoomTrack(preload('next'))
    const loading = f.engine.loadRoomTrack(input('next'))
    reply.resolve(response)
    expect(await loading).toBe(true)
    expect(f.request).toHaveBeenCalledOnce()
    await f.engine.dispose()
  })

  it('announces each track once and keeps only the newest announcement', async () => {
    const f = environment()
    f.engine.preloadRoomTrack(preload('a'))
    f.engine.preloadRoomTrack(preload('a'))
    expect(f.request).toHaveBeenCalledOnce()
    const aborted = f.request.mock.calls[0][1]!.signal!
    f.engine.preloadRoomTrack(preload('b'))
    expect(aborted.aborted).toBe(true)
    expect(f.request).toHaveBeenCalledTimes(2)
    // The superseded track now loads on its own.
    expect(await f.engine.loadRoomTrack(input('a'))).toBe(true)
    expect(f.request).toHaveBeenCalledTimes(3)
    await f.engine.dispose()
  })

  it('falls back to a normal read when the preload failed or is for another track', async () => {
    const f = environment()
    f.request.mockRejectedValueOnce(new Error('network down'))
    f.engine.preloadRoomTrack(preload('next'))
    await vi.waitFor(() => expect(f.request).toHaveBeenCalledOnce())
    expect(await f.engine.loadRoomTrack(input('next'))).toBe(true)
    expect(f.request).toHaveBeenCalledTimes(2)

    f.engine.preloadRoomTrack(preload('other'))
    expect(await f.engine.loadRoomTrack(input('different'))).toBe(true)
    expect(f.request).toHaveBeenCalledTimes(4)
    await f.engine.dispose()
  })

  it('cancels a transfer it took over when the load is cancelled, and never preloads the loaded track', async () => {
    const f = environment()
    const reply = deferred<typeof response>()
    f.request.mockReturnValueOnce(reply.promise)
    f.engine.preloadRoomTrack(preload('next'))
    const signal = f.request.mock.calls[0][1]!.signal!
    const loading = f.engine.loadRoomTrack(input('next'))
    f.engine.cancel()
    expect(await loading).toBe(false)
    expect(signal.aborted).toBe(true)

    await f.engine.loadRoomTrack(input('current'))
    f.request.mockClear()
    f.engine.preloadRoomTrack(preload('current'))
    expect(f.request).not.toHaveBeenCalled()
    await f.engine.dispose()
  })

  it('stops preloading after dispose and aborts the one in flight', async () => {
    const f = environment()
    f.request.mockReturnValueOnce(new Promise(() => {}))
    f.engine.preloadRoomTrack(preload('next'))
    const signal = f.request.mock.calls[0][1]!.signal!
    await f.engine.dispose()
    expect(signal.aborted).toBe(true)
    f.engine.preloadRoomTrack(preload('later'))
    expect(f.request).toHaveBeenCalledOnce()
  })
})
