import { registerRoomController } from './roomController.js'
import { registerPlayerController } from './playerController.js'
import { registerQueueController } from './queueController.js'
import { registerChatController } from './chatController.js'
import { registerVoteController } from './voteController.js'
import { registerAuthController } from './authController.js'
import * as syncService from '../services/syncService.js'
import { logger } from '../utils/logger.js'
import type { TypedServer } from '../middleware/types.js'

export function initializeSocket(io: TypedServer) {
  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`, { socketId: socket.id })

    // 新连接默认加入 lobby 频道（首页房间列表推送）
    socket.join('lobby')

    registerRoomController(io, socket)
    registerPlayerController(io, socket)
    registerQueueController(io, socket)
    registerChatController(io, socket)
    registerVoteController(io, socket)
    registerAuthController(io, socket)
  })

  syncService.start(io)

  logger.info('Socket.IO initialized with typed events')
}
