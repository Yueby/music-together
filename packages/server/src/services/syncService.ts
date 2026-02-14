import { roomRepo } from '../repositories/roomRepository.js'

/** 估算房间当前播放位置 */
export function estimateCurrentTime(roomId: string): number {
  const room = roomRepo.get(roomId)
  if (!room) return 0

  const { playState } = room
  if (!playState.isPlaying) return playState.currentTime

  const elapsed = (Date.now() - playState.serverTimestamp) / 1000
  return playState.currentTime + elapsed
}
