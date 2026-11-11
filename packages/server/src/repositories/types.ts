import type {
  AudioQuality,
  ChatMessage,
  PlayMode,
  PlayState,
  QueueMode,
  RoomListItem,
  Track,
  User,
} from '@music-together/shared'

/** 服务端内部房间数据模型 -- 含密码（仅通过 owner 专用 RoomState 发送给客户端） */
export interface RoomData {
  id: string
  name: string
  password: string | null
  /** 原始房间创建者 ID（永久不变；重新上线后恢复 owner 和当前房主身份） */
  creatorId: string
  /** 当前在线主持人身份，同时承担自动下一首和投票否决职责 */
  hostId: string
  /** 唯一允许提交播放进度的 Socket；同一身份多标签页时只有一个写入者 */
  conductorSocketId: string | null
  /** 持久化 admin 用户 ID 集合（离开/回来自动恢复 admin） */
  adminUserIds: Set<string>
  /** 无永久控制者在线时临时接管房间的用户；授予 admin 能力，不持久化 */
  temporaryAdminUserId: string | null
  audioQuality: AudioQuality
  users: User[]
  queue: Track[]
  currentTrack: Track | null
  playState: PlayState
  /** Latest scheduled action, kept separate until its execution time. */
  pendingPlayback?: {
    type: 'play' | 'pause' | 'resume' | 'seek' | 'stop'
    track: Track | null
    playState: PlayState & { serverTimeToExecute: number }
    timer: ReturnType<typeof setTimeout>
  } | null
  playMode: PlayMode
  queueMode: QueueMode
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
  /** 根据 roomId + userId 查找对应的 socketId（用于定向发送） */
  getSocketIdForUser(roomId: string, userId: string): string | null
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
