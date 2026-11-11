// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePlayerStore } from '@/stores/playerStore'
import { useRoomStore } from '@/stores/roomStore'
import { useMediaSession } from './useMediaSession'

const fixture = vi.hoisted(() => ({
  runtime: { kind: 'web' as const, nativeMediaSession: true },
  socket: { id: 'fixture-socket', on: vi.fn(), off: vi.fn(), emit: vi.fn() },
}))
vi.mock('@/lib/hostRuntime', () => ({ hostRuntime: fixture.runtime }))
vi.mock('@/providers/SocketProvider', () => ({
  useSocketContext: () => ({ socket: fixture.socket, isConnected: true }),
}))
vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn() } }))

describe('useMediaSession position state', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  let renders: number
  let media: { setActionHandler: ReturnType<typeof vi.fn>; setPositionState: ReturnType<typeof vi.fn>; playbackState: string; metadata: unknown }

  const store = () => usePlayerStore.getState()
  // Mirrors the player's ~10Hz time updates.
  const tick = (time: number) => act(() => store().setCurrentTime(time))

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    media = { setActionHandler: vi.fn(), setPositionState: vi.fn(), playbackState: 'none', metadata: null }
    Object.defineProperty(navigator, 'mediaSession', { configurable: true, value: media })
    usePlayerStore.getState().reset()
    useRoomStore.getState().reset()
    renders = 0
    container = document.createElement('div')
    root = createRoot(container)
    function Harness() {
      renders++
      useMediaSession({ play: vi.fn(), pause: vi.fn(), next: vi.fn(), prev: vi.fn(), seek: vi.fn() })
      return null
    }
    await act(async () => root.render(<Harness />))
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    Reflect.deleteProperty(navigator, 'mediaSession')
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('does not re-render the host component on currentTime ticks', () => {
    act(() => {
      store().setDuration(200)
      store().setIsPlaying(true)
    })
    const before = renders
    for (let i = 1; i <= 50; i++) {
      vi.advanceTimersByTime(100)
      tick(i / 10)
    }
    expect(renders).toBe(before)
  })

  it('reports the position on duration changes and play/pause toggles, but not on regular ticks', () => {
    expect(media.setPositionState).not.toHaveBeenCalled()

    act(() => store().setDuration(200))
    expect(media.setPositionState).toHaveBeenLastCalledWith({ duration: 200, playbackRate: 1, position: 0 })

    act(() => store().setIsPlaying(true))
    expect(media.setPositionState).toHaveBeenCalledTimes(2)

    for (let i = 1; i <= 100; i++) {
      vi.advanceTimersByTime(100)
      tick(i / 10)
    }
    expect(media.setPositionState).toHaveBeenCalledTimes(2)

    act(() => store().setIsPlaying(false))
    expect(media.setPositionState).toHaveBeenCalledTimes(3)
    expect(media.setPositionState).toHaveBeenLastCalledWith({ duration: 200, playbackRate: 1, position: 10 })
  })

  it('reports a seek (position jump) but follows normal progress without extra calls', () => {
    act(() => {
      store().setDuration(200)
      store().setIsPlaying(true)
    })
    media.setPositionState.mockClear()

    vi.advanceTimersByTime(1000)
    tick(1)
    expect(media.setPositionState).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    tick(90)
    expect(media.setPositionState).toHaveBeenCalledExactlyOnceWith({ duration: 200, playbackRate: 1, position: 90 })

    // Progress continues from the new anchor without another report.
    vi.advanceTimersByTime(1000)
    tick(91)
    expect(media.setPositionState).toHaveBeenCalledOnce()
  })

  it('does not treat the elapsed time of a long uninterrupted play as a seek', () => {
    act(() => {
      store().setDuration(600)
      store().setIsPlaying(true)
    })
    media.setPositionState.mockClear()

    for (let i = 1; i <= 300; i++) {
      vi.advanceTimersByTime(100)
      tick(i / 10)
    }
    expect(media.setPositionState).not.toHaveBeenCalled()
  })

  it('stops listening after unmount', async () => {
    act(() => store().setDuration(200))
    await act(async () => root.unmount())
    media.setPositionState.mockClear()
    act(() => store().setIsPlaying(true))
    expect(media.setPositionState).not.toHaveBeenCalled()
    root = createRoot(container)
  })
})
