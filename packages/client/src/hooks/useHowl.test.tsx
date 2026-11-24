// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Track } from '@music-together/shared'
import type { PlaybackSoundOptions } from '@/lib/PlaybackSound'
import { usePlayerStore } from '@/stores/playerStore'
import { useHowl } from './useHowl'

const bridge = vi.hoisted(() => ({
  create: vi.fn(),
  allowLoadRetry: false,
  supportsHtml5Analysis: false,
}))
vi.mock('@/lib/playbackSoundFactory', () => ({ playbackSoundFactory: bridge }))
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
  streamUrl: 'https://media.example.test/fixture.mp3',
}

function fakeSound() {
  return {
    duration: vi.fn(() => 120),
    seek: vi.fn(() => 0),
    volume: vi.fn(),
    play: vi.fn(() => 1),
    pause: vi.fn(),
    once: vi.fn(),
    rate: vi.fn(() => 1),
    playing: vi.fn(() => false),
    state: vi.fn(() => 'loaded'),
    unload: vi.fn(),
  }
}

describe('useHowl track loading', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  let playback: ReturnType<typeof useHowl>
  let sound: ReturnType<typeof fakeSound>
  let options: PlaybackSoundOptions

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    usePlayerStore.getState().reset()
    usePlayerStore.getState().setVolume(0.8)
    sound = fakeSound()
    bridge.create.mockImplementation((_track: Track, opts: PlaybackSoundOptions) => {
      options = opts
      return sound
    })
    container = document.createElement('div')
    root = createRoot(container)
    function Harness() {
      playback = useHowl(vi.fn())
      return null
    }
    await act(async () => root.render(<Harness />))
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('tracks download and decode progress until the sound loads', () => {
    act(() => playback.loadTrack(track, 9, false))
    const { audioLoadStartedAt } = usePlayerStore.getState()
    expect(audioLoadStartedAt).toBeTypeOf('number')
    expect(usePlayerStore.getState()).toMatchObject({
      audioLoadPhase: 'buffering',
      audioLoadProgress: null,
      audioLoadedBytes: null,
      currentTime: 9,
      duration: 120,
    })
    act(() => options.onprogress?.({ phase: 'downloading', progress: 0.25, loadedBytes: 2 }))
    expect(usePlayerStore.getState()).toMatchObject({
      audioLoadPhase: 'downloading',
      audioLoadProgress: 0.25,
      audioLoadedBytes: 2,
      audioLoadStartedAt,
    })
    act(() => options.onprogress?.({ phase: 'decoding', progress: 1, loadedBytes: 8 }))
    expect(usePlayerStore.getState()).toMatchObject({ audioLoadPhase: 'decoding', audioLoadProgress: 1 })
    act(() => options.onload?.())
    expect(usePlayerStore.getState()).toMatchObject({
      audioLoadPhase: 'idle',
      audioLoadProgress: null,
      audioLoadedBytes: null,
      audioLoadStartedAt: null,
    })
  })

  it('ignores progress from replaced sounds and clears a pending load on unload', () => {
    act(() => playback.loadTrack(track))
    const oldOptions = options
    sound = fakeSound()
    act(() => playback.loadTrack({ ...track, id: 'next' }))
    act(() => oldOptions.onprogress?.({ phase: 'decoding', progress: 1 }))
    expect(usePlayerStore.getState().audioLoadPhase).toBe('buffering')
    act(() => playback.stopAndUnload())
    act(() => options.onprogress?.({ phase: 'downloading', loadedBytes: 2 }))
    expect(usePlayerStore.getState().audioLoadPhase).toBe('idle')
  })

  it('clears loading after a terminal load failure', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    act(() => playback.loadTrack(track))
    act(() => options.onloaderror?.(1, 'LOAD_FAILED'))
    expect(usePlayerStore.getState().audioLoadPhase).toBe('idle')
  })

  it('unmutes a paused load at the volume chosen during loading, not the one captured at load start', async () => {
    await act(async () => playback.loadTrack(track, 0, false))
    expect(sound.volume).not.toHaveBeenCalled()

    // The user drags the slider while the stream is still loading.
    act(() => usePlayerStore.getState().setVolume(0.3))
    act(() => options.onload!())

    expect(sound.volume).toHaveBeenCalledExactlyOnceWith(0.3)
  })
})
