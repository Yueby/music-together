import { EVENTS, LIMITS } from '@music-together/shared'
import { roomRepo } from '../repositories/roomRepository.js'
import * as roomService from '../services/roomService.js'
import * as chatService from '../services/chatService.js'
import { estimateCurrentTime } from '../services/syncService.js'
import { createWithRoom } from '../middleware/withRoom.js'
import { logger } from '../utils/logger.js'
import type { TypedServer, TypedSocket } from '../middleware/types.js'

export function registerRoomController(io: TypedServer, socket: TypedSocket) {
  const withRoom = createWithRoom(io)

  // ---- Room list (不需要在房间内) ----
  socket.on(EVENTS.ROOM_LIST, () => {
    socket.emit(EVENTS.ROOM_LIST_UPDATE, roomService.listRooms())
  })

  // ---- Create room (含可选密码) ----
  socket.on(EVENTS.ROOM_CREATE, ({ nickname, roomName, password }) => {
    if (!nickname || typeof nickname !== 'string') {
      socket.emit(EVENTS.ROOM_ERROR, { code: 'INVALID_INPUT', message: '昵称不能为空' })
      return
    }
    if (nickname.length > LIMITS.NICKNAME_MAX_LENGTH) {
      socket.emit(EVENTS.ROOM_ERROR, { code: 'INVALID_INPUT', message: '昵称过长' })
      return
    }
    if (roomName && roomName.length > LIMITS.ROOM_NAME_MAX_LENGTH) {
      socket.emit(EVENTS.ROOM_ERROR, { code: 'INVALID_INPUT', message: '房间名过长' })
      return
    }
    if (password && password.length > LIMITS.ROOM_PASSWORD_MAX_LENGTH) {
      socket.emit(EVENTS.ROOM_ERROR, { code: 'INVALID_INPUT', message: '密码过长' })
      return
    }

    // Auto-leave any previous room before creating a new one
    autoLeaveCurrentRoom(io, socket)

    const { room, user } = roomService.createRoom(socket.id, nickname.trim(), roomName, password)

    socket.leave('lobby')
    socket.join(room.id)
    socket.emit(EVENTS.ROOM_CREATED, { roomId: room.id, userId: user.id })
    socket.emit(EVENTS.ROOM_STATE, roomService.toPublicRoomState(room))

    // 广播房间列表给大厅用户
    roomService.broadcastRoomList(io)
  })

  // ---- Join room (含密码校验) ----
  socket.on(EVENTS.ROOM_JOIN, ({ roomId, nickname, password }) => {
    if (!nickname || typeof nickname !== 'string') {
      socket.emit(EVENTS.ROOM_ERROR, { code: 'INVALID_INPUT', message: '昵称不能为空' })
      return
    }
    if (!roomId || typeof roomId !== 'string') {
      socket.emit(EVENTS.ROOM_ERROR, { code: 'INVALID_INPUT', message: '房间号不能为空' })
      return
    }

    const room = roomRepo.get(roomId)
    if (!room) {
      socket.emit(EVENTS.ROOM_ERROR, { code: 'ROOM_NOT_FOUND', message: '房间不存在' })
      return
    }

    // 密码校验（跳过已在该房间内的用户，即重连场景）
    const existingMapping = roomRepo.getSocketMapping(socket.id)
    const isRejoin = existingMapping?.roomId === roomId
    if (!isRejoin && room.password !== null) {
      if (!password || password !== room.password) {
        socket.emit(EVENTS.ROOM_ERROR, { code: 'WRONG_PASSWORD', message: '密码错误' })
        return
      }
    }

    // Auto-leave any previous room (different from target) before joining
    if (existingMapping && existingMapping.roomId !== roomId) {
      autoLeaveCurrentRoom(io, socket)
    }

    const result = roomService.joinRoom(socket.id, roomId, nickname.trim())
    if (!result) {
      socket.emit(EVENTS.ROOM_ERROR, { code: 'JOIN_FAILED', message: '加入房间失败' })
      return
    }

    const { room: updatedRoom, user } = result

    socket.leave('lobby')
    socket.join(roomId)

    // Send full room state + chat history
    socket.emit(EVENTS.ROOM_STATE, roomService.toPublicRoomState(updatedRoom))
    socket.emit(EVENTS.CHAT_HISTORY, chatService.getHistory(roomId))

    // If there's a track currently playing, send PLAYER_PLAY for sync
    if (updatedRoom.currentTrack?.streamUrl) {
      socket.emit(EVENTS.PLAYER_PLAY, {
        track: updatedRoom.currentTrack,
        playState: {
          isPlaying: updatedRoom.playState.isPlaying,
          currentTime: estimateCurrentTime(roomId),
          serverTimestamp: Date.now(),
        },
      })
    }

    // Notify others (skip for rejoin — they already know the user is in the room)
    if (!isRejoin) {
      socket.to(roomId).emit(EVENTS.ROOM_USER_JOINED, user)
    }

    // 更新大厅房间列表（人数变了）
    roomService.broadcastRoomList(io)
  })

  // ---- Leave room (explicit user action) ----
  socket.on(EVENTS.ROOM_LEAVE, () => {
    logger.info(`ROOM_LEAVE event from ${socket.id}`, { socketId: socket.id })
    handleLeave(io, socket)
  })

  // ---- Room settings (仅房主，含密码管理) ----
  socket.on(
    EVENTS.ROOM_SETTINGS,
    withRoom((ctx, data) => {
      if (ctx.user.id !== ctx.room.hostId) {
        ctx.socket.emit(EVENTS.ROOM_ERROR, { code: 'NOT_HOST', message: '只有房主能修改设置' })
        return
      }

      roomService.updateSettings(ctx.roomId, {
        mode: data.mode,
        password: data.password,
      })

      const updatedRoom = roomRepo.get(ctx.roomId)!
      io.to(ctx.roomId).emit(EVENTS.ROOM_SETTINGS, {
        mode: updatedRoom.mode,
        hasPassword: updatedRoom.password !== null,
      })

      logger.info(`Room ${ctx.roomId} settings updated`, { roomId: ctx.roomId })

      // 密码变更也要刷新大厅列表
      roomService.broadcastRoomList(io)
    }),
  )

  // ---- Disconnect ----
  socket.on('disconnect', (reason) => {
    logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`, { socketId: socket.id })
    handleLeave(io, socket)
  })
}

/**
 * Silently leave the current room (if any).
 * Used before ROOM_CREATE / ROOM_JOIN to ensure a socket is only in one room.
 */
function autoLeaveCurrentRoom(io: TypedServer, socket: TypedSocket): void {
  const result = roomService.leaveRoom(socket.id)
  if (!result) return

  const { roomId, user, room, hostChanged } = result
  socket.leave(roomId)
  socket.join('lobby')
  io.to(roomId).emit(EVENTS.ROOM_USER_LEFT, user)

  // 房主变更时广播完整状态，确保所有客户端更新 hostId
  if (hostChanged && room && room.users.length > 0) {
    io.to(roomId).emit(EVENTS.ROOM_STATE, roomService.toPublicRoomState(room))
  }

  roomService.broadcastRoomList(io)
  logger.info(`Auto-left room ${roomId} for socket ${socket.id}`, { roomId, socketId: socket.id })
}

function handleLeave(io: TypedServer, socket: TypedSocket) {
  const result = roomService.leaveRoom(socket.id)
  if (!result) return

  const { roomId, user, room, hostChanged } = result
  socket.leave(roomId)
  socket.join('lobby')
  io.to(roomId).emit(EVENTS.ROOM_USER_LEFT, user)

  // 房主变更时广播完整状态，确保所有客户端更新 hostId
  if (hostChanged && room && room.users.length > 0) {
    io.to(roomId).emit(EVENTS.ROOM_STATE, roomService.toPublicRoomState(room))
  }

  // 更新大厅房间列表
  roomService.broadcastRoomList(io)
}
