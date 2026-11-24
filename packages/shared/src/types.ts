/** Standardised error codes used across all server → client ROOM_ERROR emissions */
export const ERROR_CODE = {
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_DATA: 'INVALID_DATA',
  INTERNAL: 'INTERNAL',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  WRONG_PASSWORD: 'WRONG_PASSWORD',
  JOIN_FAILED: 'JOIN_FAILED',
  NOT_IN_ROOM: 'NOT_IN_ROOM',
  NOT_OWNER: 'NOT_OWNER',
  NO_PERMISSION: 'NO_PERMISSION',
  SET_ROLE_FAILED: 'SET_ROLE_FAILED',
  QUEUE_FULL: 'QUEUE_FULL',
  STREAM_FAILED: 'STREAM_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
  /** Create/join refused by the room-entry rate limit or the per-identity room cap (unlike RATE_LIMITED, which is in-room). */
  ROOM_ENTRY_LIMITED: 'ROOM_ENTRY_LIMITED',
  /** Server capacity or admission queue is full; user cannot enter or queue right now. */
  SERVER_FULL: 'SERVER_FULL',
  NO_VOTE_NEEDED: 'NO_VOTE_NEEDED',
  VOTE_IN_PROGRESS: 'VOTE_IN_PROGRESS',
  ALREADY_VOTED: 'ALREADY_VOTED',
} as const

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE]

export type MusicSource = 'netease' | 'tencent' | 'kugou'

export type AutoFallbackStatus = 'trying' | 'success' | 'failed'

export type AutoFallbackReasonType = 'VIP_REQUIRED' | 'COPYRIGHT_RESTRICTED' | 'NO_RESOURCE' | 'TIMEOUT' | 'UNKNOWN'

export interface RoomAutoFallbackEvent {
  /** Correlates trying/success/failed toasts */
  attemptId: string
  status: AutoFallbackStatus
  fromSource: Exclude<MusicSource, 'kugou'>
  toSource: Exclude<MusicSource, 'kugou'>
  trackTitle: string
  reasonType?: AutoFallbackReasonType
  /** Safe, short detail suitable for UI (no URLs/cookies/stack traces). */
  reasonDetail?: string
}

export type UserRole = 'owner' | 'admin' | 'member'

export type PlayMode = 'sequential' | 'loop-all' | 'loop-one' | 'shuffle'

/**
 * 队列模式（房主在设置里切换）：
 * - keep：播完的歌留在队列里，按播放模式（顺序/循环/随机）往下走——默认
 * - consume：一首歌听完（或被切走）就从队列移除，队列只往前走、不会循环，后来点的歌都排在后面；适合多人点歌
 */
export type QueueMode = 'keep' | 'consume'

/** 房主可以修改的房间设置（都是可选的，只发要改的） */
export interface RoomSettingsUpdate {
  name?: string
  /** 字符串 = 设置密码；null = 移除密码 */
  password?: string | null
  audioQuality?: AudioQuality
  queueMode?: QueueMode
}

/**
 * 实际生效的播放模式：消耗队列时歌曲播完就没了，"列表循环"和"单曲循环"没有意义，按顺序播放；
 * 顺序与随机不受影响。切回 keep 后原来选的模式依然有效（不改写已存的模式）。
 */
export function effectivePlayMode(queueMode: QueueMode | undefined, playMode: PlayMode): PlayMode {
  return queueMode === 'consume' && (playMode === 'loop-all' || playMode === 'loop-one') ? 'sequential' : playMode
}

/** 音频质量档位 (kbps)：标准 / 较高 / HQ / 无损 */
export type AudioQuality = 128 | 192 | 320 | 999

export interface Track {
  id: string
  title: string
  artist: string[]
  /** Platform ids of `artist`, index-aligned, where the platform tells us (NetEase). Lets the UI open the artist page directly. */
  artistIds?: string[]
  album: string
  duration: number
  cover: string
  /** Stable 120px artwork URL for list/search rendering. */
  thumbnailCover?: string
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

/** 客户端可见的房间状态 */
export interface RoomState {
  id: string
  name: string
  creatorId: string
  hostId: string
  /** 唯一承担权威播放进度上报的 Socket；用于区分同一身份的多个标签页。 */
  conductorSocketId: string | null
  hasPassword: boolean
  /** 密码明文（仅 owner 可见；普通成员和临时管理员只收到 hasPassword） */
  password?: string | null
  audioQuality: AudioQuality
  users: User[]
  queue: Track[]
  currentTrack: Track | null
  playState: PlayState
  /** Present when playState describes a future pending playback action. */
  serverTimeToExecute?: number
  playMode: PlayMode
  queueMode: QueueMode
}

export interface PlayState {
  isPlaying: boolean
  currentTime: number
  serverTimestamp: number
  /** Monotonic room playback generation; rejects reports from an older track/action. */
  revision: number
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

export type VoteAction = 'pause' | 'resume' | 'next' | 'prev' | 'set-mode' | 'play-track' | 'remove-track'

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
  /** https avatar of the account when the platform provides one (NetEase today). */
  avatarUrl?: string
}

/** 歌手元数据（歌手搜索结果与歌手主页头部） */
export interface Artist {
  id: string
  name: string
  cover: string
  /** Stable 120px artwork URL for list/search rendering. */
  thumbnailCover?: string
  source: MusicSource
  albumCount?: number
  songCount?: number
  /** 简介（仅歌手主页提供，搜索结果不带） */
  description?: string
}

/** 歌单元数据（用于歌单列表展示） */
export interface Playlist {
  id: string
  name: string
  cover: string
  /** Stable 120px artwork URL for list/search rendering. */
  thumbnailCover?: string
  trackCount: number
  source: MusicSource
  creator?: string
  description?: string
}

export type DiscoverHomeBlock = 'playlists' | 'artists' | 'albums'

/** 账号页首页区块（推荐歌单、热门歌手、新碟）；`/api/music/discover/home` 的响应 */
export interface DiscoverHome {
  playlists: Playlist[]
  artists: Artist[]
  albums: Playlist[]
  /** Blocks that could not be loaded (their list is empty): the client offers a retry instead of "nothing here". */
  failed: DiscoverHomeBlock[]
}

/** 服务端实时负载档位 */
export type ServerLoadLevel = 'normal' | 'busy' | 'full'

/** 客户端接入形态（网页端直连 CDN，微应用端需经服务端中转音频与封面） */
export type ClientKind = 'web' | 'mapp'

/** 对外公开的服务端承载状态快照（不含宿主机细节或敏感配置） */
export interface ServerCapacityStatus {
  /** 网页端适用的综合负载档位 */
  level: ServerLoadLevel
  /** 微应用端适用的负载档位（音频中转拥塞时会单独收紧，不误伤网页端） */
  mappLevel: ServerLoadLevel
  /** 当前在房间内的在线人数（Web + Mapp） */
  onlineUsers: number
  /** 当前活跃房间数 */
  activeRooms: number
  /** 当前已占用的加权负载单位 */
  usedUnits: number
  /** 当前动态计算的有效容量上限（加权负载单位） */
  effectiveCap: number
  /** 预计当前还可新加入的网页端人数 */
  estimatedWebRemaining: number
  /** 预计当前还可新加入的微应用人数 */
  estimatedMappRemaining: number
  /** 当前排队等候人数 */
  queueLength: number
  /** 最大允许排队人数 */
  maxQueueLength: number
  /** 综合负载压力百分比（0–100） */
  pressurePercent: number
  /** 微应用视角的综合负载压力百分比（0–100，含音频中转压力） */
  mappPressurePercent: number
  /** 当前单房间微应用听众动态上限 */
  mappRoomLimit: number
  /** 高水位软保护：是否暂时限制新建房间（仍允许加入现有房间） */
  createRestricted: boolean
  /** 快照时间戳（ms） */
  updatedAt: number
}

/** 服务端推送给排队中用户的状态更新 */
export interface AdmissionQueuedEvent {
  /** 当前排队位次（从 1 开始） */
  position: number
  /** 队列总人数 */
  queueLength: number
  /** 排队等待执行的目标动作 */
  action: 'create' | 'join'
  /** 加入房间时的目标房间号 */
  roomId?: string
  /** 触发排队的原因：综合承载满载 或 微应用音频中转拥塞 */
  reason: 'capacity' | 'mapp_stream' | 'mapp_room'
  /** 最新服务端承载状态 */
  capacity: ServerCapacityStatus
}

/** 服务端通知客户端已离开排队队列 */
export interface AdmissionCancelledEvent {
  reason: 'user' | 'room_closed' | 'password_changed' | 'expired' | 'replaced'
  message?: string
}
