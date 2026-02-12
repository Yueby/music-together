import type { ChatMessage, PlayState, RoomListItem, Track, User } from '@music-together/shared'

/** 服务端内部房间数据模型 -- 含密码（永远不发送给客户端） */
export interface RoomData {
  id: string
  name: string
  password: string | null
  hostId: string
  mode: 'host-only' | 'collaborative'
  users: User[]
  queue: Track[]
  currentTrack: Track | null
  playState: PlayState
}

export interface SocketMapping {
  roomId: string
  userId: string
}

export interface RoomRepository {
  get(roomId: string): RoomData | undefined
  set(roomId: string, room: RoomData): void
  delete(roomId: string): void
  getAll(): Map<string, RoomData>
  getAllIds(): string[]
  getAllAsList(): RoomListItem[]
  setSocketMapping(socketId: string, roomId: string, userId: string): void
  getSocketMapping(socketId: string): SocketMapping | undefined
  deleteSocketMapping(socketId: string): void
}

export interface ChatRepository {
  getHistory(roomId: string): ChatMessage[]
  addMessage(roomId: string, message: ChatMessage): void
  createRoom(roomId: string): void
  deleteRoom(roomId: string): void
}
