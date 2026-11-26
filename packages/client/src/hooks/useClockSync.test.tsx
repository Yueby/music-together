// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { EVENTS, NTP } from '@music-together/shared'
import { useClockSync } from './useClockSync'

const socket = vi.hoisted(() => ({ connected: false, on: vi.fn(), off: vi.fn(), emit: vi.fn() }))
vi.mock('@/providers/SocketProvider', () => ({ useSocketContext: () => ({ socket }) }))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

it('probes immediately on visible wakeups while connected and throttles repeated wakeups', () => {
  vi.useFakeTimers()
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  const { unmount } = renderHook(useClockSync)
  const changeVisibility = () => act(() => document.dispatchEvent(new Event('visibilitychange')))

  changeVisibility()
  socket.connected = true
  visibility.mockReturnValue('hidden')
  changeVisibility()
  expect(socket.emit).not.toHaveBeenCalled()

  visibility.mockReturnValue('visible')
  changeVisibility()
  changeVisibility()
  expect(socket.emit).toHaveBeenCalledExactlyOnceWith(EVENTS.NTP_PING, expect.any(Object))
  act(() => vi.advanceTimersByTime(Math.max(2_000, NTP.INITIAL_INTERVAL_MS)))
  socket.emit.mockClear()
  changeVisibility()
  expect(socket.emit).toHaveBeenCalledExactlyOnceWith(EVENTS.NTP_PING, expect.any(Object))
  unmount()
  act(() => vi.advanceTimersByTime(2_000))
  changeVisibility()
  expect(socket.emit).toHaveBeenCalledOnce()
})
