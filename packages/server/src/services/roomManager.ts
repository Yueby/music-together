import type { ChatMessage, RoomState, Track, User } from '@music-together/shared'
import { nanoid } from 'nanoid'
import { log } from '../utils/logger.js'

const rooms = new Map<string, RoomState>()
const chatHistory = new Map<string, ChatMessage[]>()

// Map socket.id -> { roomId, userId }
const socketToRoom = new Map<string, { roomId: string; userId: string }>()

// Grace period timers for empty rooms — gives users time to reconnect (e.g. page refresh)
const roomDeletionTimers = new Map<string, ReturnType<typeof setTimeout>>()
const ROOM_GRACE_PERIOD_MS = 30_000 // 30 seconds

export function createRoom(socketId: string, nickname: string): { room: RoomState; user: User } {
  const roomId = nanoid(6).toUpperCase()
  const userId = socketId

  const user: User = {
    id: userId,
    nickname,
    isHost: true,
  }

  const room: RoomState = {
    id: roomId,
    name: `${nickname}的房间`,
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

  rooms.set(roomId, room)
  chatHistory.set(roomId, [])
  socketToRoom.set(socketId, { roomId, userId })

  return { room, user }
}

export function joinRoom(socketId: string, roomId: string, nickname: string): { room: RoomState; user: User } | null {
  const room = rooms.get(roomId)
  if (!room) return null

  // Cancel any pending room deletion (e.g. user refreshed and is rejoining)
  const pendingTimer = roomDeletionTimers.get(roomId)
  if (pendingTimer) {
    clearTimeout(pendingTimer)
    roomDeletionTimers.delete(roomId)
    log(`Room ${roomId} deletion cancelled — user rejoined`)
  }

  const userId = socketId

  // If the socket is already in this room (e.g. rejoin after navigation),
  // update the existing user entry instead of creating a duplicate.
  const existing = room.users.find((u) => u.id === userId)
  if (existing) {
    existing.nickname = nickname
    socketToRoom.set(socketId, { roomId, userId })
    return { room, user: existing }
  }

  const user: User = {
    id: userId,
    nickname,
    isHost: false,
  }

  room.users.push(user)
  socketToRoom.set(socketId, { roomId, userId })

  return { room, user }
}

export function leaveRoom(socketId: string): { roomId: string; user: User; room: RoomState | null } | null {
  const mapping = socketToRoom.get(socketId)
  if (!mapping) return null

  const { roomId, userId } = mapping
  const room = rooms.get(roomId)
  if (!room) return null

  const user = room.users.find((u) => u.id === userId)
  if (!user) return null

  room.users = room.users.filter((u) => u.id !== userId)
  socketToRoom.delete(socketId)

  // If room is empty, schedule deletion after grace period
  // This gives time for the user to reconnect (e.g. page refresh)
  if (room.users.length === 0) {
    log(`Room ${roomId} is empty, will be deleted in ${ROOM_GRACE_PERIOD_MS / 1000}s unless someone rejoins`)
    const timer = setTimeout(() => {
      const r = rooms.get(roomId)
      // Only delete if still empty
      if (r && r.users.length === 0) {
        rooms.delete(roomId)
        chatHistory.delete(roomId)
        roomDeletionTimers.delete(roomId)
        log(`Room ${roomId} deleted after grace period (no reconnect)`)
      }
    }, ROOM_GRACE_PERIOD_MS)
    roomDeletionTimers.set(roomId, timer)
    return { roomId, user, room }
  }

  // If host left, transfer to next user
  if (room.hostId === userId && room.users.length > 0) {
    room.hostId = room.users[0].id
    room.users[0].isHost = true
  }

  return { roomId, user, room }
}

export function getRoom(roomId: string): RoomState | undefined {
  return rooms.get(roomId)
}

export function getAllRoomIds(): string[] {
  return Array.from(rooms.keys())
}

export function getRoomBySocket(socketId: string): { roomId: string; room: RoomState } | null {
  const mapping = socketToRoom.get(socketId)
  if (!mapping) return null
  const room = rooms.get(mapping.roomId)
  if (!room) return null
  return { roomId: mapping.roomId, room }
}

export function getUserBySocket(socketId: string): User | null {
  const mapping = socketToRoom.get(socketId)
  if (!mapping) return null
  const room = rooms.get(mapping.roomId)
  if (!room) return null
  return room.users.find((u) => u.id === mapping.userId) ?? null
}

export function updateRoomPlayState(
  roomId: string,
  update: Partial<RoomState['playState']>,
) {
  const room = rooms.get(roomId)
  if (room) {
    room.playState = { ...room.playState, ...update, serverTimestamp: Date.now() }
  }
}

export function setCurrentTrack(roomId: string, track: Track | null) {
  const room = rooms.get(roomId)
  if (room) {
    room.currentTrack = track
    room.playState = {
      isPlaying: track !== null,
      currentTime: 0,
      serverTimestamp: Date.now(),
    }
  }
}

export function addToQueue(roomId: string, track: Track) {
  const room = rooms.get(roomId)
  if (room) {
    room.queue.push(track)
  }
}

export function removeFromQueue(roomId: string, trackId: string) {
  const room = rooms.get(roomId)
  if (room) {
    room.queue = room.queue.filter((t) => t.id !== trackId)
  }
}

export function reorderQueue(roomId: string, trackIds: string[]) {
  const room = rooms.get(roomId)
  if (!room) return

  const trackMap = new Map(room.queue.map((t) => [t.id, t]))
  const reordered: Track[] = []
  for (const id of trackIds) {
    const track = trackMap.get(id)
    if (track) reordered.push(track)
  }
  room.queue = reordered
}

export function getNextTrack(roomId: string): Track | null {
  const room = rooms.get(roomId)
  if (!room || room.queue.length === 0) return null

  const currentIndex = room.currentTrack
    ? room.queue.findIndex((t) => t.id === room.currentTrack!.id)
    : -1

  const nextIndex = currentIndex + 1
  return nextIndex < room.queue.length ? room.queue[nextIndex] : null
}

export function addChatMessage(roomId: string, message: ChatMessage) {
  const history = chatHistory.get(roomId)
  if (history) {
    history.push(message)
    // Keep only last 200 messages
    if (history.length > 200) {
      history.splice(0, history.length - 200)
    }
  }
}

export function getChatHistory(roomId: string): ChatMessage[] {
  return chatHistory.get(roomId) ?? []
}

export function updateRoomSettings(roomId: string, settings: { mode: 'host-only' | 'collaborative' }) {
  const room = rooms.get(roomId)
  if (room) {
    room.mode = settings.mode
  }
}

export function canUserControl(socketId: string): boolean {
  const mapping = socketToRoom.get(socketId)
  if (!mapping) return false
  const room = rooms.get(mapping.roomId)
  if (!room) return false
  if (room.mode === 'collaborative') return true
  return room.hostId === mapping.userId
}
