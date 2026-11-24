import { EVENTS } from '@music-together/shared'
import { executeQueuedAdmission, registerRoomController } from './roomController.js'
import { registerPlayerController } from './playerController.js'
import { registerQueueController } from './queueController.js'
import { registerChatController } from './chatController.js'
import { registerVoteController } from './voteController.js'
import { registerAuthController } from './authController.js'
import { registerPlaylistController } from './playlistController.js'
import { admissionQueue } from '../services/admissionQueueService.js'
import { getPublicServerCapacity, setCapacityQueueHooks } from '../services/serverLoadService.js'
import { logger } from '../utils/logger.js'
import type { TypedServer } from '../middleware/types.js'

export function initializeSocket(io: TypedServer) {
  admissionQueue.setExecutor(executeQueuedAdmission)
  setCapacityQueueHooks({
    getQueueLength: () => admissionQueue.length,
    onTick: () => {
      void admissionQueue.drain(io)
    },
  })

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
    registerPlaylistController(io, socket)

    // 推送初始服务端承载状态；若该身份断线前正在排队则立即重新绑定
    socket.emit(EVENTS.SERVER_CAPACITY_UPDATE, getPublicServerCapacity())
    admissionQueue.handleReconnect(io, socket)
  })

  logger.info('Socket.IO initialized with typed events')
}
