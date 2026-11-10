import { describe, expect, it, vi } from 'vitest'
import { WebAudioPlayer } from './WebAudioPlayer.ts'

function environment(loop = false) {
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
  const createContext = vi.fn(() => context as unknown as AudioContext)
  const player = new WebAudioPlayer({ loop, createContext })
  return { player, context, sources, createContext }
}

async function loaded(loop = false) {
  const env = environment(loop)
  await env.player.load(new Uint8Array([1, 2, 3]))
  return env
}

describe('micro-app Web Audio player', () => {
  it('unloads the track while preserving the context and configured controls', async () => {
    const { player, context, sources, createContext } = await loaded()
    player.setVolume(0.4)
    player.setPlaybackRate(1.25)
    await player.play()
    player.unload()
    player.unload()
    expect(player.snapshot()).toMatchObject({ status: 'empty', duration: 0, position: 0 })
    expect(sources[0].stop).toHaveBeenCalledOnce()
    expect(context.close).not.toHaveBeenCalled()
    expect(player.getVolume()).toBe(0.4)
    expect(player.getPlaybackRate()).toBe(1.25)
    await player.load(new Uint8Array([4]))
    await player.play()
    expect(createContext).toHaveBeenCalledOnce()
    expect(sources[1].playbackRate.value).toBe(1.25)
    await player.dispose()
    player.unload()
    expect(context.close).toHaveBeenCalledOnce()
  })

  it('invalidates an unfinished decode on unload without closing the context', async () => {
    const { player, context } = environment()
    let resolve!: (buffer: AudioBuffer) => void
    context.decodeAudioData.mockReturnValueOnce(
      new Promise<AudioBuffer>((done) => {
        resolve = done
      }),
    )
    const pending = player.load(new Uint8Array([1]))
    player.unload()
    resolve({ duration: 8 } as AudioBuffer)
    expect(await pending).toBe(false)
    expect(player.snapshot()).toMatchObject({ status: 'empty', duration: 0 })
    expect(context.close).not.toHaveBeenCalled()
    expect(await player.load(new Uint8Array([2]))).toBe(true)
    await player.dispose()
  })

  it('retains the default low volume and normal playback rate', async () => {
    const { player, context, sources, createContext } = environment()
    expect(player.getVolume()).toBe(0.12)
    expect(player.getPlaybackRate()).toBe(1)
    expect(createContext).not.toHaveBeenCalled()
    await player.load(new Uint8Array([1]))
    expect(context.createGain.mock.results[0].value.gain.value).toBe(0.12)
    await player.play()
    expect(sources[0].playbackRate.value).toBe(1)
    context.currentTime = 11
    expect(player.snapshot().position).toBe(1)
    await player.dispose()
  })

  it.each([
    [0, 0.5],
    [0.4, 1.25],
    [1, 2],
  ])(
    'stores volume %s and rate %s without creating a context, then applies them on initialization',
    async (volume, rate) => {
      const { player, context, sources, createContext } = environment()
      player.setVolume(volume)
      player.setPlaybackRate(rate)
      expect(player.getVolume()).toBe(volume)
      expect(player.getPlaybackRate()).toBe(rate)
      expect(createContext).not.toHaveBeenCalled()
      expect(player.snapshot().contextState).toBe('not-created')
      await player.load(new Uint8Array([1]))
      expect(context.createGain.mock.results[0].value.gain.value).toBe(volume)
      await player.play()
      expect(sources[0].playbackRate.value).toBe(rate)
      await player.dispose()
    },
  )

  it.each([
    [Number.NaN, Number.NaN],
    [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
    [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
    [-0.01, 0.49],
    [1.01, 2.01],
  ])('rejects invalid volume %s and rate %s before creating a context', async (volume, rate) => {
    const { player, createContext } = environment()
    const before = player.snapshot()
    expect(() => player.setVolume(volume)).toThrow(new Error('INVALID_VOLUME'))
    expect(() => player.setPlaybackRate(rate)).toThrow(new Error('INVALID_PLAYBACK_RATE'))
    expect(player.getVolume()).toBe(0.12)
    expect(player.getPlaybackRate()).toBe(1)
    expect(player.snapshot()).toEqual(before)
    expect(createContext).not.toHaveBeenCalled()
    await player.dispose()
  })

  it('updates an existing gain and leaves active audio unchanged on invalid input', async () => {
    const { player, context, sources } = await loaded()
    await player.play()
    const gain = context.createGain.mock.results[0].value
    for (const volume of [0, 0.7, 1]) {
      player.setVolume(volume)
      expect(gain.gain.value).toBe(volume)
      expect(player.getVolume()).toBe(volume)
    }
    context.currentTime = 11
    player.setPlaybackRate(1.5)
    const before = player.snapshot()
    expect(() => player.setVolume(Number.NaN)).toThrow('INVALID_VOLUME')
    expect(() => player.setPlaybackRate(3)).toThrow('INVALID_PLAYBACK_RATE')
    expect(player.getVolume()).toBe(1)
    expect(gain.gain.value).toBe(1)
    expect(player.getPlaybackRate()).toBe(1.5)
    expect(sources[0].playbackRate.value).toBe(1.5)
    expect(player.snapshot()).toEqual(before)
    expect(sources).toHaveLength(1)
    expect(sources[0].stop).not.toHaveBeenCalled()
    await player.dispose()
  })

  it('reanchors rate changes continuously without restarting or replacing the active source', async () => {
    const { player, context, sources } = await loaded()
    await player.play()
    context.currentTime = 12
    expect(player.snapshot().position).toBe(2)
    player.setPlaybackRate(2)
    expect(player.snapshot().position).toBe(2)
    context.currentTime = 13
    expect(player.snapshot().position).toBe(4)
    player.setPlaybackRate(0.5)
    expect(player.snapshot().position).toBe(4)
    context.currentTime = 15
    expect(player.snapshot().position).toBe(5)
    expect(sources[0].playbackRate.value).toBe(0.5)
    expect(sources).toHaveLength(1)
    expect(context.createBufferSource).toHaveBeenCalledOnce()
    expect(context.resume).toHaveBeenCalledOnce()
    expect(sources[0].start).toHaveBeenCalledExactlyOnceWith(10, 0)
    expect(sources[0].stop).not.toHaveBeenCalled()
    expect(sources[0].disconnect).not.toHaveBeenCalled()
    await player.dispose()
  })

  it('preserves a future start and seek deadline across rate changes', async () => {
    const { player, context, sources } = await loaded()
    player.seek(2)
    await player.play(2)
    context.currentTime = 10.5
    player.setPlaybackRate(2)
    expect(player.snapshot()).toMatchObject({ status: 'scheduled', position: 2 })
    context.currentTime = 11
    player.setPlaybackRate(0.5)
    expect(player.snapshot()).toMatchObject({ status: 'scheduled', position: 2 })
    expect(sources).toHaveLength(1)
    expect(sources[0].start).toHaveBeenCalledExactlyOnceWith(12, 2)
    expect(sources[0].stop).not.toHaveBeenCalled()
    player.seek(4)
    expect(sources[1].start).toHaveBeenCalledWith(12, 4)
    expect(sources[1].playbackRate.value).toBe(0.5)
    context.currentTime = 11.5
    expect(player.snapshot()).toMatchObject({ status: 'scheduled', position: 4 })
    context.currentTime = 12
    expect(player.snapshot()).toMatchObject({ status: 'playing', position: 4 })
    context.currentTime = 13
    expect(player.snapshot().position).toBe(4.5)
    await player.dispose()
  })

  it('uses the updated rate through pause, seek, resume and repeated play', async () => {
    const { player, context, sources } = await loaded()
    await player.play()
    context.currentTime = 11
    player.setPlaybackRate(2)
    context.currentTime = 12
    player.pause()
    expect(player.snapshot()).toMatchObject({ status: 'paused', position: 3 })
    context.currentTime = 20
    player.setPlaybackRate(0.5)
    expect(player.snapshot().position).toBe(3)
    player.seek(4)
    await player.play()
    expect(sources[1].start).toHaveBeenCalledWith(20, 4)
    expect(sources[1].playbackRate.value).toBe(0.5)
    context.currentTime = 22
    expect(player.snapshot().position).toBe(5)
    player.seek(2)
    expect(sources[2].start).toHaveBeenCalledWith(22, 2)
    expect(sources[2].playbackRate.value).toBe(0.5)
    context.currentTime = 24
    await player.play()
    expect(sources[3].start).toHaveBeenCalledWith(24, 3)
    expect(sources[3].playbackRate.value).toBe(0.5)
    await player.dispose()
  })

  it('wraps the rate-adjusted loop position and preserves it when reanchoring and resuming', async () => {
    const { player, context, sources } = await loaded(true)
    player.setPlaybackRate(2)
    await player.play()
    context.currentTime = 19
    expect(player.snapshot().position).toBe(2)
    player.setPlaybackRate(0.5)
    expect(player.snapshot().position).toBe(2)
    context.currentTime = 21
    player.pause()
    expect(player.snapshot().position).toBe(3)
    context.currentTime = 30
    await player.play()
    expect(sources[1].start).toHaveBeenCalledWith(30, 3)
    expect(sources[1].loop).toBe(true)
    expect(sources[1].playbackRate.value).toBe(0.5)
    context.currentTime = 42
    expect(player.snapshot().position).toBe(1)
    await player.dispose()
  })

  it('retains natural completion and replay semantics after rate changes', async () => {
    const { player, context, sources } = await loaded()
    await player.play()
    player.setPlaybackRate(2)
    context.currentTime = 15
    expect(player.snapshot().position).toBe(8)
    sources[0].onended?.()
    expect(player.snapshot()).toMatchObject({ status: 'ended', position: 8 })
    player.setPlaybackRate(0.5)
    await player.play()
    expect(sources[1].start).toHaveBeenCalledWith(15, 0)
    expect(sources[1].playbackRate.value).toBe(0.5)
    await player.dispose()
  })

  it('keeps settings readable after disposal while rejecting setters without mutation', async () => {
    const { player, createContext } = environment()
    player.setVolume(0.6)
    player.setPlaybackRate(1.5)
    await player.dispose()
    expect(() => player.setVolume(0)).toThrow(new Error('APP_UNLOADED'))
    expect(() => player.setPlaybackRate(2)).toThrow(new Error('APP_UNLOADED'))
    expect(player.getVolume()).toBe(0.6)
    expect(player.getPlaybackRate()).toBe(1.5)
    expect(createContext).not.toHaveBeenCalled()
  })

  it('decodes a copy of SDK bytes and reports a ready buffer without playing', async () => {
    const { player, context, sources } = environment()
    const bytes = new Uint8Array([1, 2, 3])
    expect(await player.load(bytes)).toBe(true)
    expect(context.decodeAudioData.mock.calls[0][0]).not.toBe(bytes.buffer)
    expect(player.snapshot()).toMatchObject({ status: 'ready', position: 0, duration: 8 })
    expect(context.resume).not.toHaveBeenCalled()
    expect(sources).toHaveLength(0)
    await player.dispose()
  })

  it('pauses at the audio clock position and resumes with a new one-shot source', async () => {
    const { player, context, sources } = await loaded()
    await player.play()
    expect(sources[0].start).toHaveBeenCalledWith(10, 0)
    context.currentTime = 12.5
    player.pause()
    expect(sources[0].stop).toHaveBeenCalledOnce()
    context.currentTime = 20
    expect(player.snapshot()).toMatchObject({ status: 'paused', position: 2.5 })
    await player.play()
    expect(sources[1].start).toHaveBeenCalledWith(20, 2.5)
    await player.dispose()
  })

  it('seeks while playing and cancels the previous source', async () => {
    const { player, sources } = await loaded()
    await player.play()
    player.seek(4)
    expect(sources[0].stop).toHaveBeenCalledOnce()
    expect(sources[0].onended).toBeNull()
    expect(sources[1].start).toHaveBeenCalledWith(10, 4)
    expect(player.snapshot().position).toBe(4)
    await player.dispose()
  })

  it('schedules on the audio clock and preserves the deadline when seeking', async () => {
    const { player, context, sources } = await loaded()
    await player.play(1)
    expect(sources[0].start).toHaveBeenCalledWith(11, 0)
    context.currentTime = 10.5
    expect(player.snapshot()).toMatchObject({ status: 'scheduled', position: 0 })
    player.seek(4)
    expect(sources[1].start).toHaveBeenCalledWith(11, 4)
    context.currentTime = 11.25
    expect(player.snapshot()).toMatchObject({ status: 'playing', position: 4.25 })
    await player.dispose()
  })

  it('pausing before a scheduled start stops the scheduled audio node', async () => {
    const { player, context, sources } = await loaded()
    await player.play(1)
    player.pause()
    context.currentTime = 13
    expect(sources[0].stop).toHaveBeenCalledOnce()
    expect(player.snapshot()).toMatchObject({ status: 'paused', position: 0 })
    await player.dispose()
  })

  it('invokes resume synchronously and ignores its result after pause', async () => {
    const { player, context, sources } = await loaded()
    let finish!: () => void
    context.resume.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    const pending = player.play()
    expect(context.resume).toHaveBeenCalledOnce()
    player.pause()
    finish()
    expect(await pending).toBe(false)
    expect(sources).toHaveLength(0)
    await player.dispose()
  })

  it('ignores stale decode results after another load', async () => {
    const { player, context } = environment()
    let finish!: (buffer: AudioBuffer) => void
    context.decodeAudioData.mockImplementationOnce(
      () =>
        new Promise<AudioBuffer>((resolve) => {
          finish = resolve
        }),
    )
    const first = player.load(new Uint8Array([1]))
    await player.load(new Uint8Array([2]))
    finish({ duration: 99 } as AudioBuffer)
    expect(await first).toBe(false)
    expect(player.snapshot().duration).toBe(8)
    await player.dispose()
  })

  it('does not adopt a decode after disposal', async () => {
    const { player, context, sources } = environment()
    let finish!: (buffer: AudioBuffer) => void
    context.decodeAudioData.mockImplementationOnce(
      () =>
        new Promise<AudioBuffer>((resolve) => {
          finish = resolve
        }),
    )
    const pending = player.load(new Uint8Array([1]))
    await player.dispose()
    finish({ duration: 8 } as AudioBuffer)
    expect(await pending).toBe(false)
    expect(context.close).toHaveBeenCalledOnce()
    expect(sources).toHaveLength(0)
    expect(player.snapshot().status).toBe('closed')
    await expect(player.play()).rejects.toThrow('APP_UNLOADED')
  })

  it('does not start a source when resume resolves after disposal', async () => {
    const { player, context, sources } = await loaded()
    let finish!: () => void
    context.resume.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    const pending = player.play()
    await player.dispose()
    finish()
    expect(await pending).toBe(false)
    expect(sources).toHaveLength(0)
  })

  it('handles natural completion, replay and invalid positions', async () => {
    const { player, sources } = await loaded()
    await player.play()
    sources[0].onended?.()
    expect(player.snapshot()).toMatchObject({ status: 'ended', position: 8 })
    await player.play()
    expect(sources[1].start).toHaveBeenCalledWith(10, 0)
    expect(() => player.seek(Number.NaN)).toThrow('INVALID_POSITION')
    await expect(player.play(-1)).rejects.toThrow('INVALID_DELAY')
    player.seek(100)
    expect(player.snapshot()).toMatchObject({ status: 'ended', position: 8 })
    await player.dispose()
  })

  it('loops on the native source and resumes at the wrapped position', async () => {
    const { player, context, sources } = await loaded(true)
    await player.play()
    expect(sources[0].loop).toBe(true)
    context.currentTime = 28.5
    expect(player.snapshot()).toMatchObject({ status: 'playing', position: 2.5 })
    player.pause()
    context.currentTime = 100
    expect(player.snapshot()).toMatchObject({ status: 'paused', position: 2.5 })
    await player.play()
    expect(sources[1].loop).toBe(true)
    expect(sources[1].start).toHaveBeenCalledWith(100, 2.5)
    await player.dispose()
  })

  it('keeps seeking and scheduled starts within a looping buffer', async () => {
    const { player, context, sources } = await loaded(true)
    await player.play(1)
    context.currentTime = 10.5
    expect(player.snapshot()).toMatchObject({ status: 'scheduled', position: 0 })
    player.seek(7)
    expect(sources[1].loop).toBe(true)
    expect(sources[1].start).toHaveBeenCalledWith(11, 7)
    context.currentTime = 12.5
    expect(player.snapshot()).toMatchObject({ status: 'playing', position: 0.5 })
    await player.dispose()
    expect(sources[1].stop).toHaveBeenCalledOnce()
  })

  it('unlocks from a user event without starting audio', async () => {
    const { player, context, sources } = await loaded()
    const pending = player.unlock()
    expect(context.resume).toHaveBeenCalledOnce()
    expect(await pending).toBe(true)
    expect(sources).toHaveLength(0)
    await player.dispose()
  })

  it('resolves authoritative position after resume and can invalidate pending work without stopping active audio', async () => {
    const { player, sources } = await loaded(true)
    let target = 1
    const pending = player.play(0, () => target)
    target = 13
    expect(await pending).toBe(true)
    expect(sources[0].start).toHaveBeenCalledWith(10, 5)
    player.cancelPendingOperations()
    expect(sources[0].stop).not.toHaveBeenCalled()
    await player.dispose()
  })

  it('reports resume and decode failures rather than claiming playback', async () => {
    const { player, context, sources } = await loaded()
    context.resume.mockRejectedValueOnce(new Error('NotAllowedError'))
    await expect(player.play()).rejects.toThrow('NotAllowedError')
    expect(sources).toHaveLength(0)
    context.decodeAudioData.mockRejectedValueOnce(new Error('EncodingError'))
    await expect(player.load(new Uint8Array([0]))).rejects.toThrow('EncodingError')
    expect(player.snapshot().status).toBe('empty')
    await player.dispose()
  })
})
