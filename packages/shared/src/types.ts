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
}

export interface RoomState {
  id: string
  name: string
  hostId: string
  mode: 'host-only' | 'collaborative'
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
