/**
 * Room Lifecycle Service
 *
 * Manages timers (room deletion, role grace period) and debounced lobby broadcasts.
 * Extracted from roomService to separate lifecycle/timer concerns from CRUD logic
 * and eliminate the circular dependency (roomService -> playerController -> roomService).
 *
 * Dependency direction:
 *   roomService -> roomLifecycleService -> (repos, playerService, voteService, authService)
 *   roomLifecycleService does NOT depend on roomService (no circular risk).
 */

import type { RoomListItem, UserRole } from '@music-together/shared'
import { EVENTS, TIMING } from '@music-together/shared'
import { config } from '../config.js'
import type { TypedServer } from '../middleware/types.js'
import { chatRepo } from '../repositories/chatRepository.js'
import { roomRepo } from '../repositories/roomRepository.js'
import { logger } from '../utils/logger.js'
import { toPublicRoomState } from '../utils/roomUtils.js'
import { cleanupRoom as cleanupAuthRoom } from './authService.js'
import { cleanupRoom as cleanupPlayerRoom } from './playerService.js'
import { cleanupRoom as cleanupVoteRoom } from './voteService.js'

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

/** 宽限期定时器：房间变空后延迟删除，给断线用户重连的窗口 */
const roomDeletionTimers = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * 角色宽限期：特权用户（host / admin）断线后保留其角色，
 * 给重连一个恢复窗口。一个房间可同时跟踪多个断线的特权用户。
 */
interface GracedUser {
  role: UserRole
  timer: ReturnType<typeof setTimeout>
}
/** roomId -> Map<userId, GracedUser> */
const roleGraceMap = new Map<string, Map<string, GracedUser>>()

/** 防抖广播：100ms trailing debounce */
let broadcastTimer: ReturnType<typeof setTimeout> | null = null
let pendingIO: TypedServer | null = null

// ---------------------------------------------------------------------------
// Room deletion timer
// ---------------------------------------------------------------------------

export function scheduleDeletion(roomId: string, io?: TypedServer): void {
  // Prevent duplicate timers if called multiple times for the same room
  cancelDeletionTimer(roomId)

  logger.info(
    `Room ${roomId} is empty, will be deleted in ${config.room.gracePeriodMs / 1000}s unless someone rejoins`,
    { roomId },
  )
  const timer = setTimeout(() => {
    const r = roomRepo.get(roomId)
    if (r && r.users.length === 0) {
      cleanupAllGrace(roomId)
      roomRepo.delete(roomId)
      chatRepo.deleteRoom(roomId)
      cleanupPlayerRoom(roomId)
      cleanupVoteRoom(roomId)
      cleanupAuthRoom(roomId)
      roomDeletionTimers.delete(roomId)
      logger.info(`Room ${roomId} deleted after grace period`, { roomId })
      // Notify lobby users that the room is gone
      if (io) broadcastRoomList(io)
    }
  }, config.room.gracePeriodMs)
  roomDeletionTimers.set(roomId, timer)
}

export function cancelDeletionTimer(roomId: string): void {
  const timer = roomDeletionTimers.get(roomId)
  if (timer) {
    clearTimeout(timer)
    roomDeletionTimers.delete(roomId)
    logger.info(`Room ${roomId} deletion cancelled — user rejoined`, { roomId })
  }
}

// ---------------------------------------------------------------------------
// Role grace period (host + admin)
// ---------------------------------------------------------------------------

/**
 * Start a role grace period for a privileged user (host or admin).
 *
 * - When a **host**'s grace expires: transfer host to the best candidate
 *   (admin first, then first member by join order).
 * - When an **admin**'s grace expires: simply remove the entry (no transfer).
 */
export function startRoleGrace(
  roomId: string,
  userId: string,
  role: UserRole,
  io?: TypedServer,
): void {
  // Only track host and admin — members don't need grace
  if (role !== 'host' && role !== 'admin') return

  // Cancel any existing grace for this user (e.g. rapid disconnect/reconnect)
  cancelRoleGrace(roomId, userId)

  if (!roleGraceMap.has(roomId)) {
    roleGraceMap.set(roomId, new Map())
  }
  const roomGrace = roleGraceMap.get(roomId)!

  logger.info(
    `${role} (${userId}) left room ${roomId}, grace period ${TIMING.ROLE_GRACE_PERIOD_MS / 1000}s started`,
    { roomId },
  )

  const timer = setTimeout(() => {
    // Remove this user's grace entry
    roomGrace.delete(userId)
    if (roomGrace.size === 0) roleGraceMap.delete(roomId)

    if (role === 'host') {
      // Host grace expired — attempt to transfer host
      const room = roomRepo.get(roomId)
      if (!room || room.users.length === 0) return

      // Check if the original host has already returned
      if (room.users.some((u) => u.id === room.hostId)) return

      // Pick the best candidate: admin first, then first member by join order
      const candidate = room.users.find((u) => u.role === 'admin') ?? room.users[0]
      const oldHostId = room.hostId
      const previousRole = candidate.role
      room.hostId = candidate.id
      candidate.role = 'host'
      logger.info(
        `Host grace expired: transferred from ${oldHostId} to ${candidate.nickname} (was ${previousRole}) in room ${roomId}`,
        { roomId },
      )

      // Broadcast updated room state so all clients see the new host
      if (io) {
        io.to(roomId).emit(EVENTS.ROOM_STATE, toPublicRoomState(room))
      }
    } else {
      // Admin grace expired — just log, no action needed
      logger.info(`Admin grace expired for user ${userId} in room ${roomId}`, { roomId })
    }
  }, TIMING.ROLE_GRACE_PERIOD_MS)

  roomGrace.set(userId, { role, timer })
}

/** Cancel a specific user's role grace timer */
export function cancelRoleGrace(roomId: string, userId: string): void {
  const roomGrace = roleGraceMap.get(roomId)
  if (!roomGrace) return

  const entry = roomGrace.get(userId)
  if (entry) {
    clearTimeout(entry.timer)
    roomGrace.delete(userId)
    logger.info(`Role grace cancelled for ${entry.role} (${userId}) in room ${roomId}`, { roomId })
  }

  if (roomGrace.size === 0) roleGraceMap.delete(roomId)
}

/** Get the saved role for a user during grace period, or null if none */
export function getGracedRole(roomId: string, userId: string): UserRole | null {
  return roleGraceMap.get(roomId)?.get(userId)?.role ?? null
}

/** Check whether a host grace timer is currently active for a room */
export function hasHostGrace(roomId: string): boolean {
  const roomGrace = roleGraceMap.get(roomId)
  if (!roomGrace) return false
  for (const entry of roomGrace.values()) {
    if (entry.role === 'host') return true
  }
  return false
}

/** Clean up all grace timers for a room (called on room deletion) */
export function cleanupAllGrace(roomId: string): void {
  const roomGrace = roleGraceMap.get(roomId)
  if (!roomGrace) return

  for (const entry of roomGrace.values()) {
    clearTimeout(entry.timer)
  }
  roleGraceMap.delete(roomId)
  logger.info(`All role grace timers cleaned up for room ${roomId}`, { roomId })
}

// ---------------------------------------------------------------------------
// Debounced lobby broadcast
// ---------------------------------------------------------------------------

/**
 * 向 lobby 频道广播房间列表变更（100ms trailing 防抖）。
 * 多次快速调用（如 create+join、多人同时 leave）会合并为一次广播，
 * 避免重复执行 getAllAsList() 遍历和序列化。
 */
export function broadcastRoomList(io: TypedServer): void {
  pendingIO = io
  if (broadcastTimer) return
  broadcastTimer = setTimeout(() => {
    broadcastTimer = null
    if (pendingIO) {
      const rooms: RoomListItem[] = roomRepo.getAllAsList()
      pendingIO.to('lobby').emit(EVENTS.ROOM_LIST_UPDATE, rooms)
    }
  }, 100)
}
