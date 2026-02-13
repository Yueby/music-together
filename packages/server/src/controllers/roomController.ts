import { timingSafeEqual } from 'node:crypto'
import { EVENTS, ERROR_CODE, roomCreateSchema, roomJoinSchema, roomSettingsSchema, setRoleSchema } from '@music-together/shared'
import { roomRepo } from '../repositories/roomRepository.js'
import * as roomService from '../services/roomService.js'
import * as chatService from '../services/chatService.js'
import * as playerService from '../services/playerService.js'
import * as voteService from '../services/voteService.js'
import { estimateCurrentTime } from '../services/syncService.js'
import { createWithRoom } from '../middleware/withRoom.js'
import { createWithHostOnly } from '../middleware/withControl.js'
import { logger } from '../utils/logger.js'
import type { TypedServer, TypedSocket } from '../middleware/types.js'

/** Constant-time string comparison to mitigate timing attacks */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export function registerRoomController(io: TypedServer, socket: TypedSocket) {
  const withRoom = createWithRoom(io)
  const withHostOnly = createWithHostOnly(io)

  // ---- Room list (不需要在房间内) ----
  socket.on(EVENTS.ROOM_LIST, () => {
    try {
      socket.emit(EVENTS.ROOM_LIST_UPDATE, roomService.listRooms())
    } catch (err) {
      logger.error('ROOM_LIST handler error', err, { socketId: socket.id })
    }
  })

  // ---- Create room (含可选密码) ----
  socket.on(EVENTS.ROOM_CREATE, (raw) => {
    try {
      const parsed = roomCreateSchema.safeParse(raw)
      if (!parsed.success) {
        socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.INVALID_INPUT, message: parsed.error.issues[0]?.message ?? '输入格式错误' })
        return
      }
      const { nickname, roomName, password } = parsed.data

      // Auto-leave any previous room before creating a new one
      autoLeaveCurrentRoom(io, socket)

      const { room, user } = roomService.createRoom(socket.id, nickname.trim(), roomName, password)

      socket.leave('lobby')
      socket.join(room.id)
      socket.emit(EVENTS.ROOM_CREATED, { roomId: room.id, userId: user.id })
      socket.emit(EVENTS.ROOM_STATE, roomService.toPublicRoomState(room))

      // 广播房间列表给大厅用户
      roomService.broadcastRoomList(io)
    } catch (err) {
      logger.error('ROOM_CREATE handler error', err, { socketId: socket.id })
      socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.INTERNAL, message: '服务器内部错误' })
    }
  })

  // ---- Join room (含密码校验) ----
  socket.on(EVENTS.ROOM_JOIN, (raw) => {
    try {
      const parsed = roomJoinSchema.safeParse(raw)
      if (!parsed.success) {
        socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.INVALID_INPUT, message: parsed.error.issues[0]?.message ?? '输入格式错误' })
        return
      }
      const { roomId, nickname, password } = parsed.data

      const room = roomRepo.get(roomId)
      if (!room) {
        socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.ROOM_NOT_FOUND, message: '房间不存在' })
        return
      }

      // 密码校验（跳过已在该房间内的用户，即重连场景）
      const existingMapping = roomRepo.getSocketMapping(socket.id)
      const isRejoin = existingMapping?.roomId === roomId
      if (!isRejoin && room.password !== null) {
        if (!password || !safeCompare(password, room.password)) {
          socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.WRONG_PASSWORD, message: '密码错误' })
          return
        }
      }

      // Auto-leave any previous room (different from target) before joining
      if (existingMapping && existingMapping.roomId !== roomId) {
        autoLeaveCurrentRoom(io, socket)
      }

      const result = roomService.joinRoom(socket.id, roomId, nickname.trim())
      if (!result) {
        socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.JOIN_FAILED, message: '加入房间失败' })
        return
      }

      const { room: updatedRoom, user } = result

      socket.leave('lobby')
      socket.join(roomId)

      // Send full room state + chat history
      socket.emit(EVENTS.ROOM_STATE, roomService.toPublicRoomState(updatedRoom))
      socket.emit(EVENTS.CHAT_HISTORY, chatService.getHistory(roomId))

      // Sync playback state to the joining client
      const isAloneInRoom = updatedRoom.users.length === 1

      if (updatedRoom.currentTrack?.streamUrl) {
        // Alone in room + track was paused → auto-resume (host rejoining)
        const shouldAutoPlay = isAloneInRoom || updatedRoom.playState.isPlaying
        if (isAloneInRoom && !updatedRoom.playState.isPlaying) {
          updatedRoom.playState = { ...updatedRoom.playState, isPlaying: true, serverTimestamp: Date.now() }
        }
        socket.emit(EVENTS.PLAYER_PLAY, {
          track: updatedRoom.currentTrack,
          playState: {
            isPlaying: shouldAutoPlay,
            currentTime: estimateCurrentTime(roomId),
            serverTimestamp: Date.now(),
            serverTimeToExecute: Date.now(),
          },
        })
      } else if (isAloneInRoom && updatedRoom.queue.length > 0) {
        // No current track but queue has items → start playing from queue
        const firstTrack = updatedRoom.queue[0]
        playerService.playTrackInRoom(io, roomId, firstTrack)
      }

      // Send active vote state if one is in progress
      const activeVote = voteService.getActiveVote(roomId)
      if (activeVote) {
        socket.emit(EVENTS.VOTE_STARTED, voteService.toVoteState(activeVote))
      }

      // Notify others (skip for rejoin — they already know the user is in the room)
      if (!isRejoin) {
        socket.to(roomId).emit(EVENTS.ROOM_USER_JOINED, user)
        // System message for user joined (server-authoritative)
        const joinMsg = chatService.createSystemMessage(roomId, `${user.nickname} 加入了房间`)
        io.to(roomId).emit(EVENTS.CHAT_MESSAGE, joinMsg)
      }

      // 更新大厅房间列表（人数变了）
      roomService.broadcastRoomList(io)
    } catch (err) {
      logger.error('ROOM_JOIN handler error', err, { socketId: socket.id })
      socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.INTERNAL, message: '服务器内部错误' })
    }
  })

  // ---- Leave room (explicit user action) ----
  socket.on(EVENTS.ROOM_LEAVE, () => {
    try {
      logger.info(`ROOM_LEAVE event from ${socket.id}`, { socketId: socket.id })
      handleLeave(io, socket)
    } catch (err) {
      logger.error('ROOM_LEAVE handler error', err, { socketId: socket.id })
    }
  })

  // ---- Room settings (仅房主，含密码管理) ----
  socket.on(
    EVENTS.ROOM_SETTINGS,
    withHostOnly((ctx, raw) => {
      const parsed = roomSettingsSchema.safeParse(raw)
      if (!parsed.success) {
        ctx.socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.INVALID_INPUT, message: parsed.error.issues[0]?.message ?? '输入格式错误' })
        return
      }

      roomService.updateSettings(ctx.roomId, {
        name: parsed.data.name,
        password: parsed.data.password,
      })

      const updatedRoom = roomRepo.get(ctx.roomId)!
      io.to(ctx.roomId).emit(EVENTS.ROOM_SETTINGS, {
        name: updatedRoom.name,
        hasPassword: updatedRoom.password !== null,
      })

      logger.info(`Room ${ctx.roomId} settings updated`, { roomId: ctx.roomId })

      // 密码变更也要刷新大厅列表
      roomService.broadcastRoomList(io)
    }),
  )

  // ---- Set user role (仅房主) ----
  socket.on(
    EVENTS.ROOM_SET_ROLE,
    withHostOnly((ctx, raw) => {
      const parsed = setRoleSchema.safeParse(raw)
      if (!parsed.success) {
        ctx.socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.INVALID_INPUT, message: parsed.error.issues[0]?.message ?? '输入格式错误' })
        return
      }

      const { userId, role } = parsed.data
      const success = roomService.setUserRole(ctx.roomId, userId, role)
      if (!success) {
        ctx.socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.SET_ROLE_FAILED, message: '无法设置该用户的角色' })
        return
      }

      io.to(ctx.roomId).emit(EVENTS.ROOM_ROLE_CHANGED, { userId, role })
      logger.info(`Role changed: ${userId} -> ${role} in room ${ctx.roomId}`, { roomId: ctx.roomId })
    }),
  )

  // ---- Disconnect ----
  socket.on('disconnect', (reason) => {
    try {
      logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`, { socketId: socket.id })
      handleLeave(io, socket)
    } catch (err) {
      logger.error('disconnect handler error', err, { socketId: socket.id })
    }
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

  // System message for user left (server-authoritative)
  if (room && room.users.length > 0) {
    const leaveMsg = chatService.createSystemMessage(roomId, `${user.nickname} 离开了房间`)
    io.to(roomId).emit(EVENTS.CHAT_MESSAGE, leaveMsg)
  }

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

  // System message for user left (server-authoritative)
  if (room && room.users.length > 0) {
    const leaveMsg = chatService.createSystemMessage(roomId, `${user.nickname} 离开了房间`)
    io.to(roomId).emit(EVENTS.CHAT_MESSAGE, leaveMsg)
  }

  // 房主变更时广播完整状态，确保所有客户端更新 hostId
  if (hostChanged && room && room.users.length > 0) {
    io.to(roomId).emit(EVENTS.ROOM_STATE, roomService.toPublicRoomState(room))
  }

  // 更新大厅房间列表
  roomService.broadcastRoomList(io)
}
