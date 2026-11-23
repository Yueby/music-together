import {
  ERROR_CODE,
  EVENTS,
  LIMITS,
  PASSWORD_LOCKED_MESSAGE,
  roomCreateSchema,
  roomJoinSchema,
  roomSettingsSchema,
  setRoleSchema,
} from '@music-together/shared'
import type { TypedServer, TypedSocket } from '../middleware/types.js'
import type { RoomData } from '../repositories/types.js'
import { createWithOwnerOnly } from '../middleware/withControl.js'
import {
  checkRoomEntryRateLimit,
  checkRoomListRateLimit,
  clearJoinPasswordFailures,
  isJoinPasswordLocked,
  recordJoinPasswordFailure,
} from '../middleware/socketRateLimiter.js'
import { roomRepo } from '../repositories/roomRepository.js'
import * as chatService from '../services/chatService.js'
import * as playerService from '../services/playerService.js'
import { issueRejoinTicket, revokeRejoinTickets } from '../services/rejoinTicketService.js'
import * as roomService from '../services/roomService.js'
import * as voteService from '../services/voteService.js'
import { executeVoteAction } from '../services/voteActionService.js'
import { logger } from '../utils/logger.js'

async function reconcileAndBroadcastVote(io: TypedServer, roomId: string, room: RoomData): Promise<void> {
  const result = voteService.reconcileVote(
    roomId,
    room.users.map((user) => user.id),
    room.hostId,
  )
  if (!result) return

  if (!result.decided) {
    io.to(roomId).emit(EVENTS.VOTE_STARTED, voteService.toVoteState(result.vote))
    return
  }

  const claimedVote = voteService.claimVote(roomId, result.vote.id)
  if (!claimedVote) return
  const executed = result.passed ? await executeVoteAction(io, roomId, claimedVote.action, claimedVote.payload) : false
  io.to(roomId).emit(EVENTS.VOTE_RESULT, {
    passed: result.passed && executed,
    action: claimedVote.action,
    reason: result.passed && !executed ? 'action_failed' : result.reason,
  })
}

/** Rooms this identity created that still exist (a room lives until it has been empty for the grace period). */
function countRoomsCreatedBy(identityUserId: string | undefined): number {
  if (!identityUserId) return 0
  let count = 0
  for (const room of roomRepo.getAll().values()) {
    if (room.creatorId === identityUserId) count++
  }
  return count
}

export function registerRoomController(io: TypedServer, socket: TypedSocket) {
  const withOwnerOnly = createWithOwnerOnly(io)

  // ---- Room list (不需要在房间内) ----
  socket.on(EVENTS.ROOM_LIST, async () => {
    if (!(await checkRoomListRateLimit(socket))) return
    try {
      socket.emit(EVENTS.ROOM_LIST_UPDATE, roomService.listRooms())
    } catch (err) {
      logger.error('ROOM_LIST handler error', err, { socketId: socket.id })
    }
  })

  // ---- Create room (含可选密码) ----
  socket.on(EVENTS.ROOM_CREATE, async (raw) => {
    if (!(await checkRoomEntryRateLimit(socket))) return
    try {
      const parsed = roomCreateSchema.safeParse(raw)
      if (!parsed.success) {
        socket.emit(EVENTS.ROOM_ERROR, {
          code: ERROR_CODE.INVALID_INPUT,
          message: parsed.error.issues[0]?.message ?? '输入格式错误',
        })
        return
      }
      const { nickname, roomName, password } = parsed.data

      // One identity may not fill the server with rooms (checked before leaving the current room, so a refusal
      // does not also kick the user out of where they are).
      if (countRoomsCreatedBy(socket.data.identityUserId) >= LIMITS.ROOM_MAX_CREATED_PER_IDENTITY) {
        socket.emit(EVENTS.ROOM_ERROR, {
          code: ERROR_CODE.ROOM_ENTRY_LIMITED,
          message: `你创建的房间已达上限（${LIMITS.ROOM_MAX_CREATED_PER_IDENTITY} 个），请先关闭不用的房间`,
        })
        return
      }

      // Auto-leave any previous room before creating a new one
      handleLeave(io, socket, 'auto-leave before create', true)

      const { room, user } = roomService.createRoom(
        socket.id,
        nickname.trim(),
        roomName,
        password,
        socket.data.identityUserId,
      )

      socket.leave('lobby')
      socket.join(room.id)
      socket.emit(EVENTS.ROOM_CREATED, { roomId: room.id, userId: user.id })
      // 创建者是 owner，发送含密码的完整状态
      socket.emit(EVENTS.ROOM_STATE, roomService.toPublicRoomStateForOwner(room))
      const rejoin = issueRejoinTicket(room.id, user.id)
      socket.emit(EVENTS.ROOM_REJOIN_TOKEN, {
        roomId: room.id,
        token: rejoin.token,
        expiresAt: rejoin.expiresAt,
        ttlMs: rejoin.ttlMs,
      })

      // 广播房间列表给大厅用户
      roomService.broadcastRoomList(io)
    } catch (err) {
      logger.error('ROOM_CREATE handler error', err, { socketId: socket.id })
      socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.INTERNAL, message: '服务器内部错误' })
    }
  })

  // ---- Join room (含密码校验) ----
  socket.on(EVENTS.ROOM_JOIN, async (raw) => {
    if (!(await checkRoomEntryRateLimit(socket))) return
    try {
      const parsed = roomJoinSchema.safeParse(raw)
      if (!parsed.success) {
        socket.emit(EVENTS.ROOM_ERROR, {
          code: ERROR_CODE.INVALID_INPUT,
          message: parsed.error.issues[0]?.message ?? '输入格式错误',
        })
        return
      }
      const { roomId, nickname, password, rejoinToken } = parsed.data

      // After too many wrong passwords, no password is evaluated any more (so a lucky guess cannot succeed), but a
      // join that needs none — rejoin ticket, already a member, creator, admin — still goes through untouched.
      const passwordLocked = await isJoinPasswordLocked(socket, roomId)

      // Validate join request (password, rejoin scenarios) — pure business logic
      const validation = roomService.validateJoinRequest(
        roomId,
        socket.id,
        socket.data.identityUserId,
        passwordLocked ? undefined : password,
        rejoinToken,
      )
      if (!validation.valid) {
        if (validation.errorCode === 'WRONG_PASSWORD') {
          if (passwordLocked) {
            socket.emit(EVENTS.ROOM_ERROR, {
              code: ERROR_CODE.WRONG_PASSWORD,
              message: PASSWORD_LOCKED_MESSAGE,
            })
            return
          }
          await recordJoinPasswordFailure(socket, roomId)
        }
        socket.emit(EVENTS.ROOM_ERROR, {
          code: ERROR_CODE[validation.errorCode as keyof typeof ERROR_CODE] ?? ERROR_CODE.JOIN_FAILED,
          message: validation.errorMessage ?? '加入房间失败',
        })
        return
      }
      // A password that was actually checked and accepted: forget earlier typos.
      if (password && !passwordLocked && !validation.skipPassword) {
        await clearJoinPasswordFailures(socket, roomId)
      }

      // Auto-leave any previous room (different from target) before joining
      const existingMapping = roomRepo.getSocketMapping(socket.id)
      if (existingMapping && existingMapping.roomId !== roomId) {
        handleLeave(io, socket, 'auto-leave before join', true)
      }

      const result = roomService.joinRoom(socket.id, roomId, nickname.trim(), socket.data.identityUserId)
      if (!result) {
        socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.JOIN_FAILED, message: '加入房间失败' })
        return
      }

      const { room: updatedRoom, user, hostChanged, roleChanged } = result
      const rejoin = issueRejoinTicket(roomId, user.id)

      socket.leave('lobby')
      socket.join(roomId)

      // Send full room state + chat history
      // Owner 收到含密码版本，其他成员收到不含密码版本
      const isOwner = user.role === 'owner'
      const stateForJoiner = isOwner
        ? roomService.toPublicRoomStateForOwner(updatedRoom)
        : roomService.toPublicRoomState(updatedRoom)
      socket.emit(EVENTS.ROOM_STATE, stateForJoiner)

      // If conductor or roles changed (owner/admin returned, temporary admin cleared),
      // broadcast to ALL OTHER clients so permissions stay in sync.
      if (hostChanged || roleChanged) {
        socket.to(roomId).emit(EVENTS.ROOM_STATE, roomService.toPublicRoomState(updatedRoom))
      }
      socket.emit(EVENTS.ROOM_REJOIN_TOKEN, {
        roomId,
        token: rejoin.token,
        expiresAt: rejoin.expiresAt,
        ttlMs: rejoin.ttlMs,
      })
      socket.emit(EVENTS.CHAT_HISTORY, chatService.getHistory(roomId))

      // Sync playback state to the joining client (auto-resume, auto-play)
      playerService.syncPlaybackToSocket(io, socket, roomId, updatedRoom).catch((err) => {
        logger.error('syncPlaybackToSocket failed', err, { roomId })
      })

      // Reconcile an active vote with the current online membership and host.
      await reconcileAndBroadcastVote(io, roomId, updatedRoom)

      // Notify others (skip for rejoin — they already know the user is in the room)
      if (!validation.isRejoin) {
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
      handleLeave(io, socket, undefined, true)
    } catch (err) {
      logger.error('ROOM_LEAVE handler error', err, { socketId: socket.id })
    }
  })

  // ---- Room settings (仅房主，含密码管理) ----
  socket.on(
    EVENTS.ROOM_SETTINGS,
    withOwnerOnly((ctx, raw) => {
      const parsed = roomSettingsSchema.safeParse(raw)
      if (!parsed.success) {
        ctx.socket.emit(EVENTS.ROOM_ERROR, {
          code: ERROR_CODE.INVALID_INPUT,
          message: parsed.error.issues[0]?.message ?? '输入格式错误',
        })
        return
      }

      roomService.updateSettings(ctx.roomId, {
        name: parsed.data.name,
        password: parsed.data.password,
        audioQuality: parsed.data.audioQuality,
        queueMode: parsed.data.queueMode,
      })

      const updatedRoom = roomRepo.get(ctx.roomId)
      if (!updatedRoom) return

      // 仅 owner 收到密码明文，其他成员只收到 hasPassword 标记
      const baseSettings = {
        name: updatedRoom.name,
        hasPassword: updatedRoom.password !== null,
        audioQuality: updatedRoom.audioQuality,
        queueMode: updatedRoom.queueMode,
      }
      // 给 owner 发送含密码的设置
      ctx.socket.emit(EVENTS.ROOM_SETTINGS, {
        ...baseSettings,
        password: updatedRoom.password ?? null,
      })
      // 给房间内其他成员发送不含密码的设置
      ctx.socket.to(ctx.roomId).emit(EVENTS.ROOM_SETTINGS, baseSettings)

      // How the queue is walked decides what comes next (and whether it is known in advance).
      if (parsed.data.queueMode !== undefined || parsed.data.audioQuality !== undefined) {
        void playerService.preloadUpcoming(io, ctx.roomId)
      }

      logger.info(`Room ${ctx.roomId} settings updated`, { roomId: ctx.roomId })

      // 密码变更也要刷新大厅列表
      roomService.broadcastRoomList(io)
    }),
  )

  // ---- Set user role (仅房主) ----
  socket.on(
    EVENTS.ROOM_SET_ROLE,
    withOwnerOnly(async (ctx, raw) => {
      const parsed = setRoleSchema.safeParse(raw)
      if (!parsed.success) {
        ctx.socket.emit(EVENTS.ROOM_ERROR, {
          code: ERROR_CODE.INVALID_INPUT,
          message: parsed.error.issues[0]?.message ?? '输入格式错误',
        })
        return
      }

      const { userId, role } = parsed.data
      const result = roomService.setUserRole(ctx.roomId, userId, role)
      if (!result.success) {
        ctx.socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.SET_ROLE_FAILED, message: '无法设置该用户的角色' })
        return
      }

      io.to(ctx.roomId).emit(EVENTS.ROOM_ROLE_CHANGED, { userId, role })
      if (result.hostChanged || result.roleChanged) {
        // Owner must keep receiving the password-bearing state; other members
        // (including temporary admins) only receive the public state.
        ctx.socket.emit(EVENTS.ROOM_STATE, roomService.toPublicRoomStateForOwner(ctx.room))
        ctx.socket.to(ctx.roomId).emit(EVENTS.ROOM_STATE, roomService.toPublicRoomState(ctx.room))
        await reconcileAndBroadcastVote(io, ctx.roomId, ctx.room)
      }
      logger.info(`Role changed: ${userId} -> ${role} in room ${ctx.roomId}`, { roomId: ctx.roomId })
    }),
  )

  // ---- Disconnect ----
  socket.on('disconnect', (reason) => {
    try {
      logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`, { socketId: socket.id })
      handleLeave(io, socket)
      // Safety net: always clean up socket mapping and RTT data.
      // handleLeave only cleans up if the socket was in a room, but
      // NTP_PING can store RTT even for sockets that never joined a room.
      // Rate limiter counters are deliberately kept: they expire on their own, and dropping them here would let a
      // client reset its budget by reconnecting.
      roomRepo.deleteSocketMapping(socket.id)
    } catch (err) {
      logger.error('disconnect handler error', err, { socketId: socket.id })
    }
  })
}

// ---------------------------------------------------------------------------
// Unified leave handler (previously duplicated as autoLeaveCurrentRoom + handleLeave)
// ---------------------------------------------------------------------------

/**
 * Leave the current room (if any), notify other users, and update lobby.
 * Used by ROOM_LEAVE, disconnect, and auto-leave before create/join.
 */
function handleLeave(io: TypedServer, socket: TypedSocket, reason?: string, revokeTicket = false): void {
  const result = roomService.leaveRoom(socket.id, io)
  if (!result) return

  const { roomId, user, room, hostChanged, roleChanged, staleSocketOnly } = result
  if (revokeTicket) {
    revokeRejoinTickets(roomId, user.id)
  }
  socket.leave(roomId)
  socket.join('lobby')

  // Stale socket cleanup (e.g. page refresh) should only remove this socket
  // from the Socket.IO room; the user remains present via another socket.
  // If it was the conductor socket, broadcast the fallback socket assignment.
  if (staleSocketOnly) {
    if (hostChanged && room) io.to(roomId).emit(EVENTS.ROOM_STATE, roomService.toPublicRoomState(room))
    return
  }

  io.to(roomId).emit(EVENTS.ROOM_USER_LEFT, user)

  // System message for user left (server-authoritative)
  if (room && room.users.length > 0) {
    const leaveMsg = chatService.createSystemMessage(roomId, `${user.nickname} 离开了房间`)
    io.to(roomId).emit(EVENTS.CHAT_MESSAGE, leaveMsg)
  }

  // 角色或主持变更时广播完整状态，确保所有客户端更新 hostId / 权限
  // owner 收到含密码版本，其他成员不含密码
  if ((hostChanged || roleChanged) && room && room.users.length > 0) {
    const newOwner = room.users.find((u) => u.role === 'owner')
    const ownerSocketId = newOwner ? roomRepo.getSocketIdForUser(roomId, newOwner.id) : null
    if (ownerSocketId) {
      io.to(ownerSocketId).emit(EVENTS.ROOM_STATE, roomService.toPublicRoomStateForOwner(room))
      io.to(roomId).except(ownerSocketId).emit(EVENTS.ROOM_STATE, roomService.toPublicRoomState(room))
    } else {
      io.to(roomId).emit(EVENTS.ROOM_STATE, roomService.toPublicRoomState(room))
    }
  }

  // Membership and host changes can immediately pass or reject an active vote.
  if (room && room.users.length > 0) {
    void reconcileAndBroadcastVote(io, roomId, room).catch((err) => {
      logger.error('Vote reconciliation after leave failed', err, { roomId })
    })
  }

  // 更新大厅房间列表
  roomService.broadcastRoomList(io)

  if (reason) {
    logger.info(`${reason}: left room ${roomId} for socket ${socket.id}`, { roomId, socketId: socket.id })
  }
}
