import type { EVENTS } from './events.js'
import type { ChatMessage, PlayState, RoomListItem, RoomState, Track, User } from './types.js'

/** 服务端 → 客户端 事件接口 */
export interface ServerToClientEvents {
  [EVENTS.ROOM_CREATED]: (data: { roomId: string; userId: string }) => void
  [EVENTS.ROOM_STATE]: (room: RoomState) => void
  [EVENTS.ROOM_ERROR]: (error: { code: string; message: string }) => void
  [EVENTS.ROOM_USER_JOINED]: (user: User) => void
  [EVENTS.ROOM_USER_LEFT]: (user: User) => void
  [EVENTS.ROOM_SETTINGS]: (settings: { mode: RoomState['mode']; hasPassword: boolean }) => void
  [EVENTS.ROOM_LIST_UPDATE]: (rooms: RoomListItem[]) => void

  [EVENTS.PLAYER_PLAY]: (data: { track: Track; playState: PlayState }) => void
  [EVENTS.PLAYER_PAUSE]: (data: { playState: PlayState }) => void
  [EVENTS.PLAYER_SEEK]: (data: { playState: PlayState }) => void
  [EVENTS.PLAYER_SYNC_RESPONSE]: (data: {
    currentTime: number
    isPlaying: boolean
    serverTimestamp: number
  }) => void

  [EVENTS.QUEUE_UPDATED]: (data: { queue: Track[] }) => void

  [EVENTS.CHAT_MESSAGE]: (message: ChatMessage) => void
  [EVENTS.CHAT_HISTORY]: (messages: ChatMessage[]) => void
}

/** 客户端 → 服务端 事件接口 */
export interface ClientToServerEvents {
  [EVENTS.ROOM_CREATE]: (data: {
    nickname: string
    roomName?: string
    password?: string
  }) => void
  [EVENTS.ROOM_JOIN]: (data: {
    roomId: string
    nickname: string
    password?: string
  }) => void
  [EVENTS.ROOM_LEAVE]: () => void
  [EVENTS.ROOM_LIST]: () => void
  [EVENTS.ROOM_SETTINGS]: (data: {
    mode?: RoomState['mode']
    password?: string | null
  }) => void

  [EVENTS.PLAYER_PLAY]: (data?: { track?: Track }) => void
  [EVENTS.PLAYER_PAUSE]: () => void
  [EVENTS.PLAYER_SEEK]: (data: { currentTime: number }) => void
  [EVENTS.PLAYER_NEXT]: () => void
  [EVENTS.PLAYER_SYNC]: (data: { currentTime: number }) => void
  [EVENTS.PLAYER_SYNC_REQUEST]: () => void

  [EVENTS.QUEUE_ADD]: (data: { track: Track }) => void
  [EVENTS.QUEUE_REMOVE]: (data: { trackId: string }) => void
  [EVENTS.QUEUE_REORDER]: (data: { trackIds: string[] }) => void

  [EVENTS.CHAT_MESSAGE]: (data: { content: string }) => void
}
