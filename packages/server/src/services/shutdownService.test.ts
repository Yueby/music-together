import type { Server } from 'node:http'
import { EVENTS } from '@music-together/shared'
import { afterEach, expect, it, vi } from 'vitest'
import type { TypedServer } from '../middleware/types.js'
import { isShuttingDown, setShuttingDown } from './roomLifecycleService.js'
import { saveSnapshotSync, stopSnapshotScheduler } from './roomSnapshotService.js'
import { shutdownServer } from './shutdownService.js'

vi.mock('../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))
vi.mock('./roomSnapshotService.js', () => ({ saveSnapshotSync: vi.fn(), stopSnapshotScheduler: vi.fn() }))

afterEach(() => {
  setShuttingDown(false)
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

it('saves before broadcasting the restart, gives sockets time to flush and closes lingering HTTP streams', async () => {
  vi.useFakeTimers()
  const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
  let finishClosing!: () => void
  const io = {
    emit: vi.fn(),
    close: vi.fn(() => new Promise<void>((resolve) => { finishClosing = resolve })),
  }
  const httpServer = { closeIdleConnections: vi.fn(), closeAllConnections: vi.fn(() => finishClosing()) }
  vi.mocked(saveSnapshotSync).mockImplementationOnce(() => expect(isShuttingDown()).toBe(true))

  const shutdown = shutdownServer('SIGTERM', io as unknown as TypedServer, httpServer as unknown as Server)
  expect(stopSnapshotScheduler).toHaveBeenCalledOnce()
  expect(saveSnapshotSync).toHaveBeenCalledExactlyOnceWith('shutdown')
  expect(io.emit).toHaveBeenCalledExactlyOnceWith(EVENTS.SERVER_RESTARTING, { retryAfterMs: 1_000 })
  expect(vi.mocked(saveSnapshotSync).mock.invocationCallOrder[0]).toBeLessThan(io.emit.mock.invocationCallOrder[0])
  await shutdownServer('SIGINT', io as unknown as TypedServer, httpServer as unknown as Server)
  expect(saveSnapshotSync).toHaveBeenCalledOnce()
  await vi.advanceTimersByTimeAsync(99)
  expect(io.close).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  expect(io.close).toHaveBeenCalledOnce()
  expect(httpServer.closeIdleConnections).toHaveBeenCalledOnce()

  await vi.advanceTimersByTimeAsync(1_499)
  expect(httpServer.closeAllConnections).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  await shutdown
  expect(httpServer.closeAllConnections).toHaveBeenCalledOnce()
  expect(exit).toHaveBeenCalledExactlyOnceWith(0)
  expect(vi.getTimerCount()).toBe(0)
})

it('hard exits within five seconds if closing stalls', async () => {
  vi.useFakeTimers()
  const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
  const io = { emit: vi.fn(), close: () => new Promise(() => {}) }
  void shutdownServer('SIGTERM', io as unknown as TypedServer, {} as Server)
  await vi.advanceTimersByTimeAsync(4_999)
  expect(exit).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  expect(exit).toHaveBeenCalledExactlyOnceWith(1)
})
