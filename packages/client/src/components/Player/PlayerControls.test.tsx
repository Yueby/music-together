// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { QueueMode, RoomState, Track } from '@music-together/shared'

vi.mock('@/providers/SocketProvider', () => ({ useSocketContext: () => ({ socket: { emit: vi.fn() } }) }))
vi.mock('@/providers/AbilityProvider', () => ({ useAppAbility: () => ({ can: () => true }) }))

import { TooltipProvider } from '@/components/ui/tooltip'
import { usePlayerStore } from '@/stores/playerStore'
import { useRoomStore } from '@/stores/roomStore'
import { PlayerControls } from './PlayerControls'

const sampleTrack: Track = {
  id: 'netease:42',
  title: 'Test Track',
  artist: ['Artist'],
  album: 'Album',
  duration: 225,
  cover: '',
  source: 'netease',
  sourceId: '42',
  urlId: '42',
  streamUrl: 'https://media.example.test/42.mp3',
}

const reducedMotionListeners = new Set<(event: MediaQueryListEvent) => void>()
const reducedMotionMql: {
  matches: boolean
  media: string
  onchange: ((event: MediaQueryListEvent) => void) | null
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
  addListener: ReturnType<typeof vi.fn>
  removeListener: ReturnType<typeof vi.fn>
  dispatchEvent: ReturnType<typeof vi.fn>
} = {
  matches: false,
  media: '(prefers-reduced-motion: reduce)',
  onchange: null,
  addEventListener: vi.fn((event: string, listener: (e: MediaQueryListEvent) => void) => {
    if (event === 'change') reducedMotionListeners.add(listener)
  }),
  removeEventListener: vi.fn((event: string, listener: (e: MediaQueryListEvent) => void) => {
    if (event === 'change') reducedMotionListeners.delete(listener)
  }),
  addListener: vi.fn((listener: (e: MediaQueryListEvent) => void) => {
    reducedMotionListeners.add(listener)
  }),
  removeListener: vi.fn((listener: (e: MediaQueryListEvent) => void) => {
    reducedMotionListeners.delete(listener)
  }),
  dispatchEvent: vi.fn(),
}

function setReducedMotion(reducedMotion: boolean) {
  reducedMotionMql.matches = reducedMotion
  const event = { matches: reducedMotion, media: reducedMotionMql.media } as MediaQueryListEvent
  reducedMotionMql.onchange?.(event)
  for (const listener of reducedMotionListeners) {
    listener(event)
  }
}

function mockMatchMedia(reducedMotion = false) {
  setReducedMotion(reducedMotion)
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) =>
      query.includes('prefers-reduced-motion')
        ? reducedMotionMql
        : {
            matches: false,
            media: query,
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
          },
    ),
  )
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  mockMatchMedia(false)
  usePlayerStore.getState().reset()
  useRoomStore.getState().reset()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  usePlayerStore.getState().reset()
  useRoomStore.getState().reset()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function show(queueMode: QueueMode = 'keep', handlers?: Partial<{ onPlay: () => void; onPause: () => void; onNext: () => void }>) {
  useRoomStore.setState({ room: { id: 'ROOM01', queue: [], queueMode, playMode: 'loop-all' } as unknown as RoomState })
  act(() =>
    root.render(
      <TooltipProvider>
        <PlayerControls
          onPlay={handlers?.onPlay ?? vi.fn()}
          onPause={handlers?.onPause ?? vi.fn()}
          onSeek={vi.fn()}
          onNext={handlers?.onNext ?? vi.fn()}
          onPrev={vi.fn()}
          onOpenQueue={vi.fn()}
          onStartVote={vi.fn()}
        />
      </TooltipProvider>,
    ),
  )
}

const button = (label: string) => container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
const statusEl = () => container.querySelector('[data-testid="audio-load-status"]')
const waveEl = () => container.querySelector('[data-testid="audio-load-wave"]')
const ringEl = () => container.querySelector('[data-testid="audio-load-ring"]')
const sliderBufferedEl = () => container.querySelector<HTMLElement>('[data-slot="slider-buffered"]')
const sliderLoadingEl = () => container.querySelector<HTMLElement>('[data-slot="slider-loading"]')

describe('PlayerControls "previous"', () => {
  it('is there in a room that keeps its queue', () => {
    show('keep')
    expect(button('上一首')).not.toBeNull()
    expect(button('下一首')).not.toBeNull()
  })

  it('is not offered in a consumed queue, where what was heard has left it', () => {
    show('consume')
    expect(button('上一首')).toBeNull()
    expect(button('下一首')).not.toBeNull()
    expect(button('播放')).not.toBeNull()
  })
})

describe('PlayerControls audio loading indicator', () => {
  it('suppresses flicker during the first 300ms and clears cleanly if load finishes early', () => {
    vi.useFakeTimers()
    usePlayerStore.setState({ currentTrack: sampleTrack, duration: sampleTrack.duration })
    show()

    act(() => usePlayerStore.getState().setAudioLoadState({ phase: 'buffering' }))
    expect(statusEl()).toBeNull()
    expect(waveEl()).toBeNull()
    expect(ringEl()).toBeNull()
    expect(sliderLoadingEl()).toBeNull()

    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(statusEl()).toBeNull()
    expect(waveEl()).toBeNull()
    expect(ringEl()).toBeNull()

    // Finishes before 300ms — never flickers
    act(() => usePlayerStore.getState().setAudioLoadState({ phase: 'idle' }))
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(statusEl()).toBeNull()
    expect(waveEl()).toBeNull()
    expect(ringEl()).toBeNull()
    expect(button('播放')?.getAttribute('aria-busy')).toBe('false')
  })

  it('transitions through buffering, downloading, decoding, and idle with text-free ring + 3-bar wave animations', async () => {
    vi.useFakeTimers()
    const onPlay = vi.fn()
    const onNext = vi.fn()
    usePlayerStore.setState({ currentTrack: sampleTrack, duration: sampleTrack.duration, isPlaying: false })
    show('keep', { onPlay, onNext })

    // 1. Buffering revealed at 300ms — orbiting perimeter arc + 3-bar wave, zero text status prompts
    act(() => usePlayerStore.getState().setAudioLoadState({ phase: 'buffering' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(statusEl()).toBeNull()
    expect(ringEl()).not.toBeNull()
    expect(ringEl()?.getAttribute('data-ring-mode')).toBe('indeterminate')
    expect(ringEl()?.getAttribute('class')).toContain('animate-spin')
    expect(sliderLoadingEl()).not.toBeNull()
    expect(sliderBufferedEl()).toBeNull()

    // Let AnimatePresence mode="wait" finish swapping the Play icon out for the 3-bar musical wave
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    expect(waveEl()).not.toBeNull()
    expect(waveEl()?.querySelectorAll('[data-wave-bar]').length).toBe(3)
    expect(container.querySelector('[data-testid="audio-load-spinner"]')).toBeNull()

    // Controls stay interactive while loading
    const loadingBtn = button('音频加载中')
    expect(loadingBtn).not.toBeNull()
    expect(loadingBtn?.getAttribute('aria-busy')).toBe('true')
    expect(loadingBtn?.disabled).toBe(false)
    act(() => loadingBtn!.click())
    expect(onPlay).toHaveBeenCalledOnce()
    act(() => button('下一首')!.click())
    expect(onNext).toHaveBeenCalledOnce()

    // 2. Downloading with known percentage renders determinate SVG progress ring and buffered slider bar
    act(() => usePlayerStore.getState().setAudioLoadState({ phase: 'downloading', progress: 0.62, loadedBytes: 2_100_000 }))
    expect(statusEl()).toBeNull()
    expect(ringEl()).not.toBeNull()
    expect(ringEl()?.getAttribute('data-ring-mode')).toBe('determinate')
    expect(ringEl()?.getAttribute('class')).not.toContain('animate-spin')
    const progressCircle = ringEl()?.querySelectorAll('circle')[1]
    const dasharray = Number(progressCircle?.getAttribute('stroke-dasharray'))
    const dashoffset = Number(progressCircle?.getAttribute('stroke-dashoffset'))
    expect(dasharray).toBeGreaterThan(0)
    expect(dashoffset).toBeCloseTo(dasharray * 0.38, 1)
    expect(sliderBufferedEl()?.style.width).toBe('62%')
    expect(sliderLoadingEl()).toBeNull()

    // 3. Downloading with unknown total falls back to indeterminate orbiting ring + slider shimmer
    act(() => usePlayerStore.getState().setAudioLoadState({ phase: 'downloading', progress: null, loadedBytes: 512 * 1024 }))
    expect(statusEl()).toBeNull()
    expect(ringEl()?.getAttribute('data-ring-mode')).toBe('indeterminate')
    expect(ringEl()?.getAttribute('class')).toContain('animate-spin')
    expect(sliderBufferedEl()).toBeNull()
    expect(sliderLoadingEl()).not.toBeNull()

    // 4. Decoding holds full 100% perimeter ring and calm decoding wave
    act(() => usePlayerStore.getState().setAudioLoadState({ phase: 'decoding', progress: 1 }))
    expect(statusEl()).toBeNull()
    expect(ringEl()?.getAttribute('data-ring-mode')).toBe('decoding')
    expect(ringEl()?.getAttribute('class')).not.toContain('animate-spin')
    expect(ringEl()?.querySelectorAll('circle')[1]?.getAttribute('stroke-dashoffset')).toBe('0')
    expect(waveEl()?.getAttribute('data-wave-state')).toBe('decoding')

    // 5. Waiting for other room members reuses the indeterminate song loading animation
    act(() => usePlayerStore.getState().setAudioLoadState({ phase: 'waiting', progress: null, loadedBytes: null }))
    expect(ringEl()).not.toBeNull()
    expect(ringEl()?.getAttribute('data-ring-mode')).toBe('indeterminate')
    expect(ringEl()?.getAttribute('class')).toContain('animate-spin')
    expect(waveEl()?.getAttribute('data-wave-state')).toBe('loading')
    expect(sliderLoadingEl()).not.toBeNull()
    expect(button('等待房间同步')?.getAttribute('aria-busy')).toBe('true')

    // 6. Return to idle cleans up ring immediately and finishes AnimatePresence cross-fade
    act(() => usePlayerStore.getState().setAudioLoadState({ phase: 'idle' }))
    expect(ringEl()).toBeNull()
    expect(sliderBufferedEl()).toBeNull()
    expect(sliderLoadingEl()).toBeNull()
    expect(button('播放')?.getAttribute('aria-busy')).toBe('false')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(waveEl()).toBeNull()
    expect(statusEl()).toBeNull()
  })

  it('respects prefers-reduced-motion by disabling orbiting ring spin and using calm static wave bars', async () => {
    vi.useFakeTimers()
    mockMatchMedia(true)
    usePlayerStore.setState({ currentTrack: sampleTrack, duration: sampleTrack.duration })
    show()

    act(() => usePlayerStore.getState().setAudioLoadState({ phase: 'buffering' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350)
    })

    expect(ringEl()?.getAttribute('class')).not.toContain('animate-spin')
    const bars = waveEl()?.querySelectorAll('[data-wave-bar]')
    expect(bars?.length).toBe(3)
    for (const bar of bars ?? []) {
      expect(bar.getAttribute('data-reduced-motion')).toBe('true')
    }
    expect(sliderLoadingEl()).not.toBeNull()
  })
})
