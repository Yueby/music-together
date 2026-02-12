export type MusicSource = 'netease' | 'tencent' | 'kugou' | 'kuwo' | 'baidu'

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
  /** 点歌人昵称（服务端在加入队列时注入） */
  requestedBy?: string
}

/** 客户端可见的房间状态（不含密码明文，只含 hasPassword 标记） */
export interface RoomState {
  id: string
  name: string
  hostId: string
  mode: 'host-only' | 'collaborative'
  hasPassword: boolean
  users: User[]
  queue: Track[]
  currentTrack: Track | null
  playState: PlayState
}

export interface PlayState {
  isPlaying: boolean
  currentTime: number
  serverTimestamp: number
}

export interface User {
  id: string
  nickname: string
  isHost: boolean
}

export interface ChatMessage {
  id: string
  userId: string
  nickname: string
  content: string
  timestamp: number
  type: 'user' | 'system'
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
