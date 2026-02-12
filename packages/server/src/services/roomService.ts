import { EVENTS } from '@music-together/shared'
import type { RoomListItem, RoomState, User } from '@music-together/shared'
import { nanoid } from 'nanoid'
import { config } from '../config.js'
import type { RoomData } from '../repositories/types.js'
import { roomRepo } from '../repositories/roomRepository.js'
import { chatRepo } from '../repositories/chatRepository.js'
import { logger } from '../utils/logger.js'
import { cleanupRoom as cleanupPlayerRoom } from '../controllers/playerController.js'
import type { TypedServer } from '../middleware/types.js'

/** 宽限期定时器：房间变空后延迟删除，给断线用户重连的窗口 */
const roomDeletionTimers = new Map<string, ReturnType<typeof setTimeout>>()

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createRoom(
  socketId: string,
  nickname: string,
  roomName?: string,
  password?: string | null,
): { room: RoomData; user: User } {
  const roomId = nanoid(6).toUpperCase()
  const userId = socketId

  const user: User = { id: userId, nickname, isHost: true }

  const room: RoomData = {
    id: roomId,
    name: roomName?.trim() || `${nickname}的房间`,
    password: password || null,
    hostId: userId,
    mode: 'collaborative',
    users: [user],
    queue: [],
    currentTrack: null,
    playState: {
      isPlaying: false,
      currentTime: 0,
      serverTimestamp: Date.now(),
    },
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
): { room: RoomData; user: User } | null {
  const room = roomRepo.get(roomId)
  if (!room) return null

  // Cancel any pending room deletion (e.g. user refreshed and is rejoining)
  cancelDeletionTimer(roomId)

  const userId = socketId

  // Rejoin — update existing user entry instead of creating duplicate
  const existing = room.users.find((u) => u.id === userId)
  if (existing) {
    existing.nickname = nickname
    roomRepo.setSocketMapping(socketId, roomId, userId)
    return { room, user: existing }
  }

  // If the room is empty (grace period), the first joiner becomes host
  const shouldBeHost = room.users.length === 0
  const user: User = { id: userId, nickname, isHost: shouldBeHost }

  if (shouldBeHost) {
    room.hostId = userId
    logger.info(`User ${nickname} became host of empty room ${roomId}`, { roomId })
  }

  room.users.push(user)
  roomRepo.setSocketMapping(socketId, roomId, userId)

  logger.info(`User ${nickname} joined room ${roomId}`, { roomId })
  return { room, user }
}

export function leaveRoom(socketId: string): {
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

  const user = room.users.find((u) => u.id === userId)
  if (!user) return null

  room.users = room.users.filter((u) => u.id !== userId)
  roomRepo.deleteSocketMapping(socketId)

  // If room is empty, schedule deletion after grace period
  if (room.users.length === 0) {
    scheduleDeletion(roomId)
    return { roomId, user, room, hostChanged: false }
  }

  // If host left, transfer to next user
  let hostChanged = false
  if (room.hostId === userId && room.users.length > 0) {
    const newHost = room.users[0]
    room.hostId = newHost.id
    newHost.isHost = true
    hostChanged = true
    logger.info(`Host transferred from ${user.nickname} to ${newHost.nickname} in room ${roomId}`, { roomId })
  }

  logger.info(`User ${user.nickname} left room ${roomId}`, { roomId })
  return { roomId, user, room, hostChanged }
}

export function getRoom(roomId: string): RoomData | undefined {
  return roomRepo.get(roomId)
}

export function listRooms(): RoomListItem[] {
  return roomRepo.getAllAsList()
}

export function updateSettings(
  roomId: string,
  settings: { mode?: 'host-only' | 'collaborative'; password?: string | null },
): void {
  const room = roomRepo.get(roomId)
  if (!room) return

  if (settings.mode !== undefined) {
    room.mode = settings.mode
  }

  // password: string -> set password; null -> remove password; undefined -> no change
  if (settings.password !== undefined) {
    room.password = settings.password
  }
}

/** 将内部 RoomData 转为客户端可见的 RoomState（不含密码） */
export function toPublicRoomState(data: RoomData): RoomState {
  return {
    id: data.id,
    name: data.name,
    hostId: data.hostId,
    mode: data.mode,
    hasPassword: data.password !== null,
    users: data.users,
    queue: data.queue,
    currentTrack: data.currentTrack,
    playState: data.playState,
  }
}

/** 向 lobby 频道广播房间列表变更 */
export function broadcastRoomList(io: TypedServer): void {
  io.to('lobby').emit(EVENTS.ROOM_LIST_UPDATE, listRooms())
}

export function canUserControl(socketId: string): boolean {
  const mapping = roomRepo.getSocketMapping(socketId)
  if (!mapping) return false
  const room = roomRepo.get(mapping.roomId)
  if (!room) return false
  if (room.mode === 'collaborative') return true
  return room.hostId === mapping.userId
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
// Internal helpers
// ---------------------------------------------------------------------------

function scheduleDeletion(roomId: string): void {
  logger.info(
    `Room ${roomId} is empty, will be deleted in ${config.room.gracePeriodMs / 1000}s unless someone rejoins`,
    { roomId },
  )
  const timer = setTimeout(() => {
    const r = roomRepo.get(roomId)
    if (r && r.users.length === 0) {
      roomRepo.delete(roomId)
      chatRepo.deleteRoom(roomId)
      cleanupPlayerRoom(roomId)
      roomDeletionTimers.delete(roomId)
      logger.info(`Room ${roomId} deleted after grace period`, { roomId })
    }
  }, config.room.gracePeriodMs)
  roomDeletionTimers.set(roomId, timer)
}

function cancelDeletionTimer(roomId: string): void {
  const timer = roomDeletionTimers.get(roomId)
  if (timer) {
    clearTimeout(timer)
    roomDeletionTimers.delete(roomId)
    logger.info(`Room ${roomId} deletion cancelled — user rejoined`, { roomId })
  }
}
