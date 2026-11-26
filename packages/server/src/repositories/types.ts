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

export interface PendingPrepare {
  track: Track
  revision: number
  startAt: number
  pendingSockets: Set<string>
  readyCount: number
  failedCount: number
  deadlineAt: number
  generation: number
  timer: ReturnType<typeof setTimeout>
}

/** 服务端内部房间数据模型 -- 含密码（仅通过 owner 专用 RoomState 发送给客户端） */
export interface RoomData {
  id: string
  name: string
  password: string | null
  /** 原始房间创建者 ID（永久不变；重新上线后恢复 owner 和当前房主身份） */
  creatorId: string
  /** 当前在线主持人身份，承担投票否决职责 */
  hostId: string
  /** 当前主持人的代表 Socket，供旧客户端兼容使用 */
  conductorSocketId: string | null
  /** 持久化 admin 用户 ID 集合（离开/回来自动恢复 admin） */
  adminUserIds: Set<string>
  /** 无永久控制者在线时临时接管房间的用户；授予 admin 能力，不持久化 */
  temporaryAdminUserId: string | null
  audioQuality: AudioQuality
  users: User[]
  /** Identities allowed to return after a disconnect or restore. */
  returningMembers?: Map<string, { nickname: string; expiresAt: number; departedAt: number }>
  emptySince?: number | null
  /** Restored playback is activated only after an identity joins. */
  awaitingFirstJoin?: boolean
  queue: Track[]
  currentTrack: Track | null
  playState: PlayState
  pendingPrepare?: PendingPrepare | null
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
  getRoomSocketIds(roomId: string): string[]
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
