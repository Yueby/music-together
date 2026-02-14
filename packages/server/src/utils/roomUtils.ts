import type { RoomState } from '@music-together/shared'
import type { RoomData } from '../repositories/types.js'

/** 将内部 RoomData 转为客户端可见的 RoomState（不含密码） */
export function toPublicRoomState(data: RoomData): RoomState {
  return {
    id: data.id,
    name: data.name,
    hostId: data.hostId,
    hasPassword: data.password !== null,
    users: data.users,
    queue: data.queue,
    currentTrack: data.currentTrack,
    playState: data.playState,
    playMode: data.playMode,
  }
}
