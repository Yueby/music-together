import type { EVENTS } from './events.js'
import type {
  AudioQuality,
  ChatMessage,
  MusicSource,
  MyPlatformAuth,
  PlayMode,
  Playlist,
  PlatformAuthStatus,
  RoomListItem,
  RoomState,
  ScheduledPlayState,
  Track,
  User,
  UserRole,
  VoteAction,
  VoteState,
} from './types.js'

/** 服务端 → 客户端 事件接口 */
export interface ServerToClientEvents {
  [EVENTS.ROOM_CREATED]: (data: { roomId: string; userId: string }) => void
  [EVENTS.ROOM_STATE]: (room: RoomState) => void
  [EVENTS.ROOM_ERROR]: (error: { code: string; message: string }) => void
  [EVENTS.ROOM_USER_JOINED]: (user: User) => void
  [EVENTS.ROOM_USER_LEFT]: (user: User) => void
  [EVENTS.ROOM_SETTINGS]: (settings: { name: string; hasPassword: boolean; audioQuality: AudioQuality }) => void
  [EVENTS.ROOM_LIST_UPDATE]: (rooms: RoomListItem[]) => void
  [EVENTS.ROOM_ROLE_CHANGED]: (data: { userId: string; role: UserRole }) => void

  [EVENTS.PLAYER_PLAY]: (data: { track: Track; playState: ScheduledPlayState }) => void
  [EVENTS.PLAYER_PAUSE]: (data: { playState: ScheduledPlayState }) => void
  [EVENTS.PLAYER_RESUME]: (data: { playState: ScheduledPlayState }) => void
  [EVENTS.PLAYER_SEEK]: (data: { playState: ScheduledPlayState }) => void
  [EVENTS.PLAYER_SYNC_RESPONSE]: (data: { currentTime: number; isPlaying: boolean; serverTimestamp: number }) => void

  // NTP clock sync
  [EVENTS.NTP_PONG]: (data: { clientPingId: number; serverTime: number }) => void

  [EVENTS.QUEUE_UPDATED]: (data: { queue: Track[] }) => void

  [EVENTS.CHAT_MESSAGE]: (message: ChatMessage) => void
  [EVENTS.CHAT_HISTORY]: (messages: ChatMessage[]) => void

  [EVENTS.VOTE_STARTED]: (vote: VoteState) => void
  [EVENTS.VOTE_RESULT]: (data: { passed: boolean; action: VoteAction; reason?: string }) => void

  // Auth
  [EVENTS.AUTH_QR_GENERATED]: (data: { key: string; qrimg: string }) => void
  [EVENTS.AUTH_QR_STATUS]: (data: { status: number; message: string }) => void
  [EVENTS.AUTH_SET_COOKIE_RESULT]: (data: {
    success: boolean
    message: string
    platform?: MusicSource
    cookie?: string
    reason?: 'expired' | 'error'
  }) => void
  [EVENTS.AUTH_STATUS_UPDATE]: (data: PlatformAuthStatus[]) => void
  [EVENTS.AUTH_MY_STATUS]: (data: MyPlatformAuth[]) => void

  // Playlist
  [EVENTS.PLAYLIST_MY_LIST]: (data: { platform: MusicSource; playlists: Playlist[] }) => void
}

/** 客户端 → 服务端 事件接口 */
export interface ClientToServerEvents {
  [EVENTS.ROOM_CREATE]: (data: { nickname: string; roomName?: string; password?: string; userId?: string }) => void
  [EVENTS.ROOM_JOIN]: (data: { roomId: string; nickname: string; password?: string; userId?: string }) => void
  [EVENTS.ROOM_LEAVE]: () => void
  [EVENTS.ROOM_LIST]: () => void
  [EVENTS.ROOM_SETTINGS]: (data: { name?: string; password?: string | null; audioQuality?: AudioQuality }) => void
  [EVENTS.ROOM_SET_ROLE]: (data: { userId: string; role: 'admin' | 'member' }) => void

  [EVENTS.PLAYER_PLAY]: (data?: { track?: Track }) => void
  [EVENTS.PLAYER_PAUSE]: () => void
  [EVENTS.PLAYER_SEEK]: (data: { currentTime: number }) => void
  [EVENTS.PLAYER_NEXT]: () => void
  [EVENTS.PLAYER_PREV]: () => void
  [EVENTS.PLAYER_SYNC]: (data: { currentTime: number; hostServerTime?: number }) => void
  [EVENTS.PLAYER_SYNC_REQUEST]: () => void
  [EVENTS.PLAYER_SET_MODE]: (data: { mode: PlayMode }) => void

  [EVENTS.QUEUE_ADD]: (data: { track: Track }) => void
  [EVENTS.QUEUE_REMOVE]: (data: { trackId: string }) => void
  [EVENTS.QUEUE_REORDER]: (data: { trackIds: string[] }) => void
  [EVENTS.QUEUE_CLEAR]: () => void

  [EVENTS.CHAT_MESSAGE]: (data: { content: string }) => void

  [EVENTS.VOTE_START]: (data: { action: VoteAction; payload?: Record<string, unknown> }) => void
  [EVENTS.VOTE_CAST]: (data: { approve: boolean }) => void

  // Auth
  [EVENTS.AUTH_REQUEST_QR]: (data: { platform: MusicSource }) => void
  [EVENTS.AUTH_CHECK_QR]: (data: { key: string; platform: MusicSource }) => void
  [EVENTS.AUTH_SET_COOKIE]: (data: { platform: MusicSource; cookie: string }) => void
  [EVENTS.AUTH_LOGOUT]: (data: { platform: MusicSource }) => void
  [EVENTS.AUTH_GET_STATUS]: () => void

  // Playlist
  [EVENTS.PLAYLIST_GET_MY]: (data: { platform: MusicSource }) => void

  // Queue batch
  [EVENTS.QUEUE_ADD_BATCH]: (data: { tracks: Track[]; playlistName?: string }) => void

  // NTP clock sync
  [EVENTS.NTP_PING]: (data: { clientPingId: number; lastRttMs?: number }) => void
}
