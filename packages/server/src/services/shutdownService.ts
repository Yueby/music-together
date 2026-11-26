import { EVENTS } from '@music-together/shared'
import type { Server } from 'node:http'
import type { TypedServer } from '../middleware/types.js'
import { logger } from '../utils/logger.js'
import { admissionQueue } from './admissionQueueService.js'
import { clearAllTimers, isShuttingDown, setShuttingDown } from './roomLifecycleService.js'
import { saveSnapshotSync, stopSnapshotScheduler } from './roomSnapshotService.js'
import { stopServerLoadMonitor } from './serverLoadService.js'

export async function shutdownServer(signal: string, io: TypedServer, httpServer: Server): Promise<void> {
  if (isShuttingDown()) return
  setShuttingDown(true)
  const hardExitTimer = setTimeout(() => process.exit(1), 5_000)
  logger.info(`Received ${signal}, shutting down gracefully...`)
  stopSnapshotScheduler()
  saveSnapshotSync('shutdown')
  io.emit(EVENTS.SERVER_RESTARTING, { retryAfterMs: 1_000 })
  await new Promise<void>((resolve) => setTimeout(resolve, 100))

  stopServerLoadMonitor()
  admissionQueue.clear()
  clearAllTimers()
  // Socket.IO closes its attached HTTP server after closing the socket connections.
  const closing = io.close()
  httpServer.closeIdleConnections?.()
  const forceCloseTimer = setTimeout(() => httpServer.closeAllConnections?.(), 1_500)
  await closing
  clearTimeout(forceCloseTimer)
  clearTimeout(hardExitTimer)
  logger.info('Server closed')
  process.exit(0)
}
