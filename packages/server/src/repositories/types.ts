import type { AudioQuality, ChatMessage, PlayMode, PlayState, RoomListItem, Track, User } from '@music-together/shared'

/** 服务端内部房间数据模型 -- 含密码（永远不发送给客户端） */
export interface RoomData {
  id: string
  name: string
  password: string | null
  /** 房间创建者 ID（永久不变，创建者可自动回收 host） */
  creatorId: string
  hostId: string
  /** 持久化 admin 用户 ID 集合（不受 grace period 影响） */
  adminUserIds: Set<string>
  audioQuality: AudioQuality
  users: User[]
  queue: Track[]
  currentTrack: Track | null
  playState: PlayState
  playMode: PlayMode
}

export interface SocketMapping {
  roomId: string
  userId: string
}

export interface RoomRepository {
  get(roomId: string): RoomData | undefined
  set(roomId: string, room: RoomData): void
  delete(roomId: string): void
  getAll(): ReadonlyMap<string, RoomData>
  getAllIds(): string[]
  getAllAsList(): RoomListItem[]
  setSocketMapping(socketId: string, roomId: string, userId: string): void
  getSocketMapping(socketId: string): SocketMapping | undefined
  deleteSocketMapping(socketId: string): void
  /** Check if a user has another active socket in the same room (excluding a specific socket) */
  hasOtherSocketForUser(roomId: string, userId: string, excludeSocketId: string): boolean
  /** Store a smoothed RTT measurement for a given socket */
  setSocketRTT(socketId: string, rttMs: number): void
  /** Retrieve the current smoothed RTT for a socket (default 0) */
  getSocketRTT(socketId: string): number
  /** Get the P90 RTT among all sockets in a room (falls back to max for ≤3 sockets) */
  getP90RTT(roomId: string): number
}

export interface ChatRepository {
  getHistory(roomId: string): ChatMessage[]
  addMessage(roomId: string, message: ChatMessage): void
  createRoom(roomId: string): void
  deleteRoom(roomId: string): void
}
