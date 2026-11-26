// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RoomState } from '@music-together/shared'
import { toast } from 'sonner'
import { usePlayerStore } from '@/stores/playerStore'
import { useRoomStore } from '@/stores/roomStore'
import { useVersionStore } from '@/stores/versionStore'
import { handlePreloadError } from './preloadError'

vi.mock('sonner', () => ({ toast: { info: vi.fn() } }))

afterEach(() => {
  vi.useRealTimers()
  window.sessionStorage.clear()
  useRoomStore.getState().reset()
  usePlayerStore.getState().reset()
  useVersionStore.setState({ hasUpdate: false, breakingUpdate: false })
})

describe('vite:preloadError', () => {
  it('prompts for a later refresh during active room playback', () => {
    useRoomStore.setState({ room: { id: 'ABC123' } as RoomState })
    usePlayerStore.getState().setIsPlaying(true)
    const reload = vi.fn()
    handlePreloadError(new Event('vite:preloadError', { cancelable: true }), reload)
    expect(reload).not.toHaveBeenCalled()
    expect(useVersionStore.getState().hasUpdate).toBe(true)
    expect(toast.info).toHaveBeenCalledWith('发现新版本，方便时可刷新更新', { id: 'vite-preload-error' })
    expect(usePlayerStore.getState().isPlaying).toBe(true)
  })

  it('reloads again only after the 60-second cooldown has elapsed', () => {
    vi.useFakeTimers()
    const firstReloadAt = new Date('2026-01-01T00:00:00Z').getTime()
    vi.setSystemTime(firstReloadAt)
    const first = new Event('vite:preloadError', { cancelable: true })
    const second = new Event('vite:preloadError', { cancelable: true })
    const third = new Event('vite:preloadError', { cancelable: true })
    const reload = vi.fn()
    handlePreloadError(first, reload)
    expect(window.sessionStorage.getItem('mt:vite-preload-reload-attempted')).toBe(String(firstReloadAt))

    vi.setSystemTime(firstReloadAt + 60_000)
    handlePreloadError(second, reload)
    expect(reload).toHaveBeenCalledOnce()
    expect(first.defaultPrevented).toBe(true)
    expect(second.defaultPrevented).toBe(false)

    vi.setSystemTime(firstReloadAt + 60_001)
    handlePreloadError(third, reload)
    expect(reload).toHaveBeenCalledTimes(2)
    expect(third.defaultPrevented).toBe(true)
    expect(window.sessionStorage.getItem('mt:vite-preload-reload-attempted')).toBe(String(firstReloadAt + 60_001))
  })
})
