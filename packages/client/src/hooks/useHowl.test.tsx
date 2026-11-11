// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Track } from '@music-together/shared'
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

type SoundOptions = { onload?: () => void }

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

describe('useHowl volume handling while a track is loading', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  let playback: ReturnType<typeof useHowl>
  let sound: ReturnType<typeof fakeSound>
  let options: SoundOptions

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    usePlayerStore.getState().reset()
    usePlayerStore.getState().setVolume(0.8)
    sound = fakeSound()
    bridge.create.mockImplementation((_track: Track, opts: SoundOptions) => {
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
