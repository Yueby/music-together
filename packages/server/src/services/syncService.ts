import { roomRepo } from '../repositories/roomRepository.js'

/** 估算房间当前播放位置 */
export function estimateCurrentTime(roomId: string): number {
  const room = roomRepo.get(roomId)
  if (!room) return 0

  const { playState } = room
  if (!playState.isPlaying) return playState.currentTime

  // Clamp elapsed to 0 — serverTimestamp can be a future scheduleTime
  // (set in playTrackInRoom/seekTrack), so Date.now() - serverTimestamp
  // may be negative before the scheduled execution moment.
  const elapsed = Math.max(0, (Date.now() - playState.serverTimestamp) / 1000)
  return playState.currentTime + elapsed
}
