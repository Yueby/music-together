import type { RoomState } from '@music-together/shared'
import type { RoomData } from '../repositories/types.js'

/** 将内部 RoomData 转为客户端可见的 RoomState（不含密码明文） */
export function toPublicRoomState(data: RoomData): RoomState {
  return {
    id: data.id,
    name: data.name,
    creatorId: data.creatorId,
    hostId: data.hostId,
    conductorSocketId: data.conductorSocketId,
    hasPassword: data.password !== null,
    audioQuality: data.audioQuality,
    users: data.users,
    queue: data.queue,
    currentTrack: data.pendingPlayback ? data.pendingPlayback.track : data.currentTrack,
    playState: data.pendingPlayback
      ? {
          isPlaying: data.pendingPlayback.playState.isPlaying,
          currentTime: data.pendingPlayback.playState.currentTime,
          serverTimestamp: data.pendingPlayback.playState.serverTimestamp,
          revision: data.pendingPlayback.playState.revision,
        }
      : data.playState,
    serverTimeToExecute: data.pendingPlayback?.playState.serverTimeToExecute,
    playMode: data.playMode,
    queueMode: data.queueMode,
  }
}

/** 仅 owner 可见的完整房间状态（含密码明文，用于设置面板展示） */
export function toPublicRoomStateForOwner(data: RoomData): RoomState {
  return {
    ...toPublicRoomState(data),
    password: data.password ?? null,
  }
}
