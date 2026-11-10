// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Track } from '@music-together/shared'
import { createMappPlaybackSoundFactory } from '../../../mapp/src/compat/MappPlaybackSoundFactory.ts'
import { usePlayerStore } from '@/stores/playerStore'
import { useHowl } from './useHowl'

const bridge = vi.hoisted(() => ({
  create: vi.fn(),
  allowLoadRetry: false,
  supportsHtml5Analysis: false,
}))
const nativeAudio = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NATIVE_AUDIO_TRIPWIRE')
  }),
)
vi.mock('@/lib/playbackSoundFactory', () => ({ playbackSoundFactory: bridge }))
vi.mock('howler', () => ({ Howl: nativeAudio }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const track: Track = {
  id: 'netease:fixture',
  title: 'Fixture',
  artist: ['Fixture'],
  album: '',
  duration: 120,
  cover: '',
  source: 'netease',
  sourceId: '1',
  urlId: '1',
  streamUrl: 'https://unreviewed.example.test/must-not-be-requested',
}
const response = () => ({
  status: 200,
  headers: { 'content-type': 'audio/mpeg' },
  body: new Uint8Array([0xff, 0xfb, 0x90, 0, 0, 0, 0, 0]),
})

function audioEnvironment() {
  const sources: Array<{ stop: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn> }> = []
  const context = Object.assign(new EventTarget(), {
    state: 'suspended' as AudioContextState,
    currentTime: 10,
    destination: {},
    createGain: vi.fn(() => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() })),
    createBufferSource: vi.fn(() => {
      const source = {
        buffer: null,
        loop: false,
        playbackRate: { value: 1 },
        onended: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }
      sources.push(source)
      return source
    }),
    decodeAudioData: vi.fn(async () => ({ duration: 120 }) as AudioBuffer),
    resume: vi.fn(async () => {
      context.state = 'running'
    }),
    close: vi.fn(async () => {
      context.state = 'closed'
    }),
  })
  const request = vi.fn(async () => response())
  const sdk = { permissions: { has: () => true }, http: { request } } as unknown as Parameters<
    typeof createMappPlaybackSoundFactory
  >[0]['sdk']
  const factory = createMappPlaybackSoundFactory({
    sdk,
    getRoomId: () => 'ABC123',
    mode: 'bytes',
    createContext: () => context as unknown as AudioContext,
  })
  bridge.create.mockImplementation((...args: Parameters<typeof factory.create>) => factory.create(...args))
  return { factory, context, sources, request }
}

async function settle() {
  await act(async () => {
    for (let index = 0; index < 30; index++) await Promise.resolve()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  })
}

describe('shared playback hook with the SDK media factory', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  let env: ReturnType<typeof audioEnvironment>
  let playback: ReturnType<typeof useHowl>
  let onEnd: ReturnType<typeof vi.fn<() => void>>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('NATIVE_FETCH_TRIPWIRE')
      }),
    )
    usePlayerStore.getState().reset()
    usePlayerStore.getState().setVolume(0.8)
    env = audioEnvironment()
    onEnd = vi.fn()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    function Harness() {
      playback = useHowl(onEnd)
      return null
    }
    await act(async () => root.render(<Harness />))
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    await env.factory.dispose()
    container.remove()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uses the original load/start hook with SDK bytes and authoritative positions', async () => {
    await act(async () => playback.loadTrack(track, 17, false))
    await settle()
    expect(env.request).toHaveBeenCalledOnce()
    expect(env.request).toHaveBeenCalledWith(
      'roomAudio',
      expect.objectContaining({
        query: { roomId: 'ABC123', trackId: track.id },
        responseType: 'bytes',
      }),
    )
    expect(playback.howlRef.current?.state()).toBe('loaded')
    expect(playback.howlRef.current?.seek()).toBe(17)
    expect(usePlayerStore.getState().duration).toBe(120)
    expect(usePlayerStore.getState().isPlaying).toBe(false)
    await act(async () => playback.startPlayback(() => 42))
    await settle()
    expect(playback.soundIdRef.current).toBeTypeOf('number')
    expect(playback.howlRef.current?.seek(undefined, playback.soundIdRef.current)).toBe(42)
    expect(usePlayerStore.getState().isPlaying).toBe(true)
    expect(env.context.createGain.mock.results[0].value.gain.value).toBe(0.8)
    const sourceCount = env.sources.length
    playback.howlRef.current!.rate(1.01)
    env.context.currentTime = 12
    expect(playback.howlRef.current!.rate()).toBe(1.01)
    expect(playback.howlRef.current!.seek()).toBeCloseTo(44.02)
    expect(env.sources).toHaveLength(sourceCount)
    await act(async () => playback.howlRef.current!.pause(playback.soundIdRef.current))
    await settle()
    expect(usePlayerStore.getState().isPlaying).toBe(false)
    env.context.currentTime = 17
    expect(playback.howlRef.current!.seek()).toBeCloseTo(44.02)
    expect(nativeAudio).not.toHaveBeenCalled()
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(onEnd).not.toHaveBeenCalled()
  })

  it('applies an authoritative paused position received while the SDK download is pending', async () => {
    let finish!: (body: ReturnType<typeof response>) => void
    env.request.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    await act(async () => playback.loadTrack(track, 3, true))
    expect(playback.howlRef.current?.state()).toBe('loading')
    await act(async () => {
      playback.setDesiredPlayback(false, () => 23)
      playback.howlRef.current!.seek(23)
    })
    finish(response())
    await settle()
    expect(playback.howlRef.current?.state()).toBe('loaded')
    expect(playback.howlRef.current?.seek()).toBe(23)
    expect(usePlayerStore.getState().currentTime).toBe(23)
    expect(usePlayerStore.getState().isPlaying).toBe(false)
    expect(env.sources).toHaveLength(0)
    expect(env.request).toHaveBeenCalledOnce()
    expect(onEnd).not.toHaveBeenCalled()
  })

  it('does not replay a failed source request through the Web retry path', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    env.request.mockResolvedValueOnce({ ...response(), status: 403 })
    await act(async () => playback.loadTrack(track))
    await settle()
    expect(env.request).toHaveBeenCalledOnce()
    expect(onEnd).toHaveBeenCalledOnce()
    expect(nativeAudio).not.toHaveBeenCalled()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('reuses one audio context across track replacement and ignores unloaded work', async () => {
    await act(async () => playback.loadTrack(track, 0, false))
    await settle()
    const old = playback.howlRef.current
    await act(async () => playback.loadTrack({ ...track, id: 'netease:next' }, 0, false))
    await settle()
    expect(old?.state()).toBe('unloaded')
    expect(env.context.createGain).toHaveBeenCalledOnce()
    expect(env.context.close).not.toHaveBeenCalled()
    expect(usePlayerStore.getState().currentTrack?.id).toBe('netease:next')
    await act(async () => playback.stopAndUnload())
    expect(playback.howlRef.current).toBeNull()
    expect(env.context.close).not.toHaveBeenCalled()
  })
})
