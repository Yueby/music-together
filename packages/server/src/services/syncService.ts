import { EVENTS } from '@music-together/shared'
import { config } from '../config.js'
import { roomRepo } from '../repositories/roomRepository.js'
import { logger } from '../utils/logger.js'
import type { TypedServer } from '../middleware/types.js'

let intervalHandle: ReturnType<typeof setInterval> | null = null

/** 启动定时同步广播 */
export function start(io: TypedServer): void {
  if (intervalHandle) return

  intervalHandle = setInterval(() => {
    for (const roomId of roomRepo.getAllIds()) {
      const room = roomRepo.get(roomId)
      if (!room || !room.playState.isPlaying || !room.currentTrack) continue

      // Exclude the host — the host is the ground truth and doesn't need
      // to sync with itself.  This eliminates the "seek bounce-back" that
      // previously caused the host to stutter.
      const broadcastTarget = room.hostId
        ? (io.to(roomId) as ReturnType<typeof io.to>).except(room.hostId)
        : io.to(roomId)

      broadcastTarget.emit(EVENTS.PLAYER_SYNC_RESPONSE, {
        currentTime: estimateCurrentTime(roomId),
        isPlaying: room.playState.isPlaying,
        serverTimestamp: Date.now(),
      })
    }
  }, config.sync.broadcastIntervalMs)

  logger.info('SyncEngine started')
}

/** 停止同步广播（进程退出时调用） */
export function stop(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle)
    intervalHandle = null
    logger.info('SyncEngine stopped')
  }
}

/** 估算房间当前播放位置 */
export function estimateCurrentTime(roomId: string): number {
  const room = roomRepo.get(roomId)
  if (!room) return 0

  const { playState } = room
  if (!playState.isPlaying) return playState.currentTime

  const elapsed = (Date.now() - playState.serverTimestamp) / 1000
  return playState.currentTime + elapsed
}
