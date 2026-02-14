import { timingSafeEqual } from 'node:crypto'
import type { RoomListItem, User } from '@music-together/shared'
import { nanoid } from 'nanoid'
import type { RoomData } from '../repositories/types.js'
import { roomRepo } from '../repositories/roomRepository.js'
import { chatRepo } from '../repositories/chatRepository.js'
import {
  scheduleDeletion,
  cancelDeletionTimer,
  startRoleGrace,
  cancelRoleGrace,
  getGracedRole,
  hasHostGrace,
} from './roomLifecycleService.js'
import { logger } from '../utils/logger.js'
import type { TypedServer } from '../middleware/types.js'

// Re-export from their new homes so existing `roomService.xxx()` callers
// in controllers don't need import changes.
export { toPublicRoomState } from '../utils/roomUtils.js'
export { broadcastRoomList } from './roomLifecycleService.js'

// ---------------------------------------------------------------------------
// Public API — Room CRUD
// ---------------------------------------------------------------------------

export function createRoom(
  socketId: string,
  nickname: string,
  roomName?: string,
  password?: string | null,
  persistentUserId?: string,
): { room: RoomData; user: User } {
  const roomId = nanoid(6).toUpperCase()
  const userId = persistentUserId || socketId

  const user: User = { id: userId, nickname, role: 'host' }

  const room: RoomData = {
    id: roomId,
    name: roomName?.trim() || `${nickname}的房间`,
    password: password || null,
    hostId: userId,
    users: [user],
    queue: [],
    currentTrack: null,
    playState: {
      isPlaying: false,
      currentTime: 0,
      serverTimestamp: Date.now(),
    },
    playMode: 'sequential',
  }

  roomRepo.set(roomId, room)
  chatRepo.createRoom(roomId)
  roomRepo.setSocketMapping(socketId, roomId, userId)

  logger.info(`Room created: ${roomId} by ${nickname}`, { roomId })
  return { room, user }
}

export function joinRoom(
  socketId: string,
  roomId: string,
  nickname: string,
  persistentUserId?: string,
): { room: RoomData; user: User } | null {
  const room = roomRepo.get(roomId)
  if (!room) return null

  // Cancel any pending room deletion (e.g. user refreshed and is rejoining)
  cancelDeletionTimer(roomId)

  const userId = persistentUserId || socketId

  // Check if this user has a saved role from the grace period
  const gracedRole = getGracedRole(roomId, userId)
  const isReturningHost = room.hostId === userId

  // Cancel the user's own grace timer if they are returning
  if (gracedRole) {
    cancelRoleGrace(roomId, userId)
  }

  // Rejoin — update existing user entry instead of creating duplicate
  const existing = room.users.find((u) => u.id === userId)
  if (existing) {
    existing.nickname = nickname
    // Restore graced role if available, otherwise keep existing role
    if (gracedRole) {
      existing.role = gracedRole
      if (gracedRole === 'host') {
        room.hostId = userId
      }
      logger.info(`Restored ${gracedRole} role for ${nickname} on rejoin in room ${roomId}`, { roomId })
    } else if (room.hostId === existing.id) {
      existing.role = 'host'
    }
    roomRepo.setSocketMapping(socketId, roomId, userId)
    return { room, user: existing }
  }

  // Determine the role for this new user entry
  let role: User['role'] = 'member'

  if (gracedRole === 'host' || isReturningHost) {
    // Returning host (with or without grace) — restore host role
    role = 'host'
    room.hostId = userId
    logger.info(`Host ${nickname} reclaimed room ${roomId}`, { roomId })
  } else if (gracedRole === 'admin') {
    // Returning admin — restore admin role
    role = 'admin'
    logger.info(`Admin ${nickname} reclaimed role in room ${roomId}`, { roomId })
  } else if (room.users.length === 0) {
    // Empty room — check if a host grace is active
    if (hasHostGrace(roomId)) {
      // Host grace period is active — don't overwrite hostId, join as member
      logger.info(`User ${nickname} joined empty room ${roomId} as member (host grace active)`, { roomId })
    } else {
      // No grace period — normal host takeover
      role = 'host'
      room.hostId = userId
      logger.info(`User ${nickname} became host of empty room ${roomId}`, { roomId })
    }
  }

  const user: User = { id: userId, nickname, role }
  room.users.push(user)
  roomRepo.setSocketMapping(socketId, roomId, userId)

  logger.info(`User ${nickname} joined room ${roomId} as ${role}`, { roomId })
  return { room, user }
}

export function leaveRoom(socketId: string, io?: TypedServer): {
  roomId: string
  user: User
  room: RoomData | null
  hostChanged: boolean
} | null {
  const mapping = roomRepo.getSocketMapping(socketId)
  if (!mapping) return null

  const { roomId, userId } = mapping
  const room = roomRepo.get(roomId)
  if (!room) return null

  // Race condition guard: if the user has another active socket in this room
  // (e.g. page refresh — new socket joined before old socket disconnected),
  // only clean up the stale mapping without removing the user from the room.
  if (roomRepo.hasOtherSocketForUser(roomId, userId, socketId)) {
    roomRepo.deleteSocketMapping(socketId)
    logger.info(`Stale disconnect for user ${userId} in room ${roomId} — newer socket exists`, { roomId })
    return null
  }

  const user = room.users.find((u) => u.id === userId)
  if (!user) return null

  room.users = room.users.filter((u) => u.id !== userId)
  roomRepo.deleteSocketMapping(socketId)

  // Start role grace period for privileged users (host or admin)
  // so they can reclaim their role on reconnect within the grace window
  if (user.role === 'host' || user.role === 'admin') {
    startRoleGrace(roomId, userId, user.role, io)
  }

  // If room is empty, schedule deletion after grace period
  if (room.users.length === 0) {
    scheduleDeletion(roomId, io)
    return { roomId, user, room, hostChanged: false }
  }

  // hostChanged stays false — hostId is intentionally preserved during grace period
  // The actual transfer happens when the grace timer expires in roomLifecycleService
  let hostChanged = false

  logger.info(`User ${user.nickname} left room ${roomId}`, { roomId })
  return { roomId, user, room, hostChanged }
}

// ---------------------------------------------------------------------------
// Public API — Read / Settings / Roles
// ---------------------------------------------------------------------------

export function getRoom(roomId: string): RoomData | undefined {
  return roomRepo.get(roomId)
}

export function listRooms(): RoomListItem[] {
  return roomRepo.getAllAsList()
}

export function updateSettings(
  roomId: string,
  settings: { name?: string; password?: string | null },
): void {
  const room = roomRepo.get(roomId)
  if (!room) return

  if (settings.name !== undefined) {
    room.name = settings.name
  }

  // password: string -> set password; null -> remove password; undefined -> no change
  if (settings.password !== undefined) {
    room.password = settings.password
  }
}

export function setUserRole(roomId: string, targetUserId: string, role: 'admin' | 'member'): boolean {
  const room = roomRepo.get(roomId)
  if (!room) return false
  const user = room.users.find((u) => u.id === targetUserId)
  if (!user) return false
  // Cannot change host's role via this method
  if (user.id === room.hostId) return false
  user.role = role
  return true
}

export function getUserBySocket(socketId: string): User | null {
  const mapping = roomRepo.getSocketMapping(socketId)
  if (!mapping) return null
  const room = roomRepo.get(mapping.roomId)
  if (!room) return null
  return room.users.find((u) => u.id === mapping.userId) ?? null
}

export function getRoomBySocket(socketId: string): { roomId: string; room: RoomData } | null {
  const mapping = roomRepo.getSocketMapping(socketId)
  if (!mapping) return null
  const room = roomRepo.get(mapping.roomId)
  if (!room) return null
  return { roomId: mapping.roomId, room }
}

// ---------------------------------------------------------------------------
// Join validation (business logic extracted from roomController)
// ---------------------------------------------------------------------------

/** Constant-time string comparison to mitigate timing attacks */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export interface JoinValidationResult {
  valid: boolean
  errorCode?: string
  errorMessage?: string
  /** Whether this is a rejoin (user already in room or same socket mapping) — skip join notification */
  isRejoin: boolean
  /** Whether password should be bypassed (rejoin, already in room, or returning host) */
  skipPassword: boolean
}

/**
 * Validate a join request: check room existence, password, rejoin scenarios.
 * Pure business logic — no socket operations.
 */
export function validateJoinRequest(
  roomId: string,
  socketId: string,
  password?: string,
  persistentUserId?: string,
): JoinValidationResult {
  const room = roomRepo.get(roomId)
  if (!room) {
    return { valid: false, errorCode: 'ROOM_NOT_FOUND', errorMessage: '房间不存在', isRejoin: false, skipPassword: false }
  }

  const existingMapping = roomRepo.getSocketMapping(socketId)
  const effectiveUserId = persistentUserId || socketId
  const alreadyInRoom = room.users.some((u) => u.id === effectiveUserId)
  const isReturningPrivileged = getGracedRole(roomId, effectiveUserId) !== null
  const isReturningHost = room.hostId === effectiveUserId && !alreadyInRoom

  // Password bypass: same socket mapping, already in room, returning host, or returning privileged user
  const skipPassword = existingMapping?.roomId === roomId || alreadyInRoom || isReturningHost || isReturningPrivileged
  // Notification skip: only when user is literally still in the room
  const isRejoin = existingMapping?.roomId === roomId || alreadyInRoom

  if (!skipPassword && room.password !== null) {
    if (!password || !safeCompare(password, room.password)) {
      return { valid: false, errorCode: 'WRONG_PASSWORD', errorMessage: '密码错误', isRejoin, skipPassword }
    }
  }

  // Auto-leave check: if the socket is mapped to a different room, the caller
  // should call leaveRoom before proceeding. We just flag the scenario here.

  return { valid: true, isRejoin, skipPassword }
}
