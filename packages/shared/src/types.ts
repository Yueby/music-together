/** Standardised error codes used across all server → client ROOM_ERROR emissions */
export const ERROR_CODE = {
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_DATA: 'INVALID_DATA',
  INTERNAL: 'INTERNAL',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  WRONG_PASSWORD: 'WRONG_PASSWORD',
  JOIN_FAILED: 'JOIN_FAILED',
  NOT_IN_ROOM: 'NOT_IN_ROOM',
  NOT_HOST: 'NOT_HOST',
  NO_PERMISSION: 'NO_PERMISSION',
  SET_ROLE_FAILED: 'SET_ROLE_FAILED',
  QUEUE_FULL: 'QUEUE_FULL',
  STREAM_FAILED: 'STREAM_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
  NO_VOTE_NEEDED: 'NO_VOTE_NEEDED',
  VOTE_IN_PROGRESS: 'VOTE_IN_PROGRESS',
  ALREADY_VOTED: 'ALREADY_VOTED',
} as const

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE]

export type MusicSource = 'netease' | 'tencent' | 'kugou'

export type UserRole = 'host' | 'admin' | 'member'

export type PlayMode = 'sequential' | 'loop-all' | 'loop-one' | 'shuffle'

/** 音频质量档位 (kbps)：标准 / 较高 / HQ / 无损 */
export type AudioQuality = 128 | 192 | 320 | 999

export interface Track {
  id: string
  title: string
  artist: string[]
  album: string
  duration: number
  cover: string
  source: MusicSource
  sourceId: string
  urlId: string
  lyricId?: string
  picId?: string
  streamUrl?: string
  /** 是否为 VIP / 付费歌曲（可能无法播放或仅试听） */
  vip?: boolean
  /** 点歌人昵称（服务端在加入队列时注入） */
  requestedBy?: string
}

/** 客户端可见的房间状态（不含密码明文，只含 hasPassword 标记） */
export interface RoomState {
  id: string
  name: string
  hostId: string
  hasPassword: boolean
  audioQuality: AudioQuality
  users: User[]
  queue: Track[]
  currentTrack: Track | null
  playState: PlayState
  playMode: PlayMode
}

export interface PlayState {
  isPlaying: boolean
  currentTime: number
  serverTimestamp: number
}

/**
 * Scheduled action payload — server tells clients to execute an action
 * at a specific future server-time, so all clients act in unison.
 */
export interface ScheduledPlayState extends PlayState {
  /** Server-clock timestamp at which clients should execute this action */
  serverTimeToExecute: number
}

export interface User {
  id: string
  nickname: string
  role: UserRole
}

export interface ChatMessage {
  id: string
  userId: string
  nickname: string
  content: string
  timestamp: number
  type: 'user' | 'system'
}

export type VoteAction = 'pause' | 'resume' | 'next' | 'prev' | 'set-mode'

export interface VoteState {
  id: string
  action: VoteAction
  initiatorId: string
  initiatorNickname: string
  votes: Record<string, boolean>
  requiredVotes: number
  totalUsers: number
  expiresAt: number
  /** Optional payload for parameterized actions (e.g. target play mode) */
  payload?: Record<string, unknown>
}

/** 房间列表项 -- 用于首页房间大厅展示（轻量，不含完整 queue/users） */
export interface RoomListItem {
  id: string
  name: string
  hasPassword: boolean
  userCount: number
  currentTrackTitle: string | null
  currentTrackArtist: string | null
}

/** 平台认证状态（前端展示用，不含 cookie 明文） */
export interface PlatformAuthStatus {
  platform: MusicSource
  /** 该平台已登录的用户数 */
  loggedInCount: number
  /** 是否有 VIP 用户 */
  hasVip: boolean
  /** 最高 VIP 等级 (0=无, 1=VIP, 11=黑胶) */
  maxVipType: number
}

/** 当前用户自己在某平台的认证信息 */
export interface MyPlatformAuth {
  platform: MusicSource
  loggedIn: boolean
  nickname?: string
  vipType?: number
}
