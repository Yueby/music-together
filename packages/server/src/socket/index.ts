import type { Server } from 'socket.io'
import { registerRoomHandlers } from './roomHandler.js'
import { registerPlayerHandlers } from './playerHandler.js'
import { registerQueueHandlers } from './queueHandler.js'
import { registerChatHandlers } from './chatHandler.js'
import { startSyncEngine } from './syncEngine.js'
import { log } from '../utils/logger.js'

export function initializeSocket(io: Server) {
  io.on('connection', (socket) => {
    log(`Client connected: ${socket.id}`)

    registerRoomHandlers(io, socket)
    registerPlayerHandlers(io, socket)
    registerQueueHandlers(io, socket)
    registerChatHandlers(io, socket)
  })

  startSyncEngine(io)

  log('Socket.IO initialized')
}
