import type { PlayState, Track } from '@music-together/shared'
import { EVENTS } from '@music-together/shared'
import { roomRepo } from '../repositories/roomRepository.js'
import { musicProvider } from './musicProvider.js'
import { estimateCurrentTime } from './syncService.js'
import { logger } from '../utils/logger.js'
import type { TypedServer } from '../middleware/types.js'

/**
 * Resolve stream URL / cover, set current track, and broadcast PLAYER_PLAY.
 * Returns true on success, false on failure.
 */
export async function playTrackInRoom(
  io: TypedServer,
  roomId: string,
  track: Track,
): Promise<boolean> {
  const room = roomRepo.get(roomId)
  if (!room) return false

  const resolved = { ...track }

  // Fetch stream URL if missing
  if (!resolved.streamUrl) {
    try {
      const url = await musicProvider.getStreamUrl(resolved.source, resolved.urlId)
      if (!url) {
        logger.warn(`Cannot get stream URL for "${resolved.title}", skipping`, { roomId })
        io.to(roomId).emit(EVENTS.ROOM_ERROR, {
          code: 'STREAM_FAILED',
          message: `无法获取「${resolved.title}」的播放链接，已跳过`,
        })
        return false
      }
      resolved.streamUrl = url
    } catch (err) {
      logger.error(`getStreamUrl failed for ${resolved.urlId}`, err, { roomId })
      return false
    }
  }

  // Fetch cover if missing
  if (!resolved.cover && resolved.picId) {
    try {
      const cover = await musicProvider.getCover(resolved.source, resolved.picId)
      if (cover) resolved.cover = cover
    } catch {
      // Non-critical, leave cover empty
    }
  }

  // Update room state
  room.currentTrack = resolved
  room.playState = {
    isPlaying: true,
    currentTime: 0,
    serverTimestamp: Date.now(),
  }

  io.to(roomId).emit(EVENTS.PLAYER_PLAY, {
    track: resolved,
    playState: room.playState,
  })

  logger.info(`Playing: ${resolved.title} in room ${roomId}`, { roomId })
  return true
}

export function resumeTrack(io: TypedServer, roomId: string): void {
  const room = roomRepo.get(roomId)
  if (!room || !room.currentTrack) return

  room.playState = { ...room.playState, isPlaying: true, serverTimestamp: Date.now() }
  io.to(roomId).emit(EVENTS.PLAYER_RESUME, { playState: room.playState })
}

export function pauseTrack(io: TypedServer, roomId: string): void {
  const room = roomRepo.get(roomId)
  if (!room) return

  // Snapshot estimated position before pausing so resume starts from the correct point
  const snapshotTime = estimateCurrentTime(roomId)
  room.playState = { isPlaying: false, currentTime: snapshotTime, serverTimestamp: Date.now() }
  io.to(roomId).emit(EVENTS.PLAYER_PAUSE, { playState: room.playState })
}

export function seekTrack(io: TypedServer, roomId: string, currentTime: number): void {
  const room = roomRepo.get(roomId)
  if (!room) return

  room.playState = { ...room.playState, currentTime, serverTimestamp: Date.now() }
  io.to(roomId).emit(EVENTS.PLAYER_SEEK, { playState: room.playState })
}

export function updatePlayState(roomId: string, update: Partial<PlayState>): void {
  const room = roomRepo.get(roomId)
  if (room) {
    room.playState = { ...room.playState, ...update, serverTimestamp: Date.now() }
  }
}

export function setCurrentTrack(roomId: string, track: Track | null): void {
  const room = roomRepo.get(roomId)
  if (room) {
    room.currentTrack = track
    room.playState = {
      isPlaying: track !== null,
      currentTime: 0,
      serverTimestamp: Date.now(),
    }
  }
}
