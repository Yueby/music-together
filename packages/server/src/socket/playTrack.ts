import type { Server } from 'socket.io'
import type { Track } from '@music-together/shared'
import { EVENTS } from '@music-together/shared'
import * as roomManager from '../services/roomManager.js'
import { musicProvider } from '../services/musicProvider.js'
import { log, logError } from '../utils/logger.js'

/**
 * Shared logic: resolve stream URL / cover, set current track, and broadcast PLAYER_PLAY.
 * Used by both playerHandler (explicit play) and queueHandler (auto-play first track).
 */
export async function playTrackInRoom(
  io: Server,
  roomId: string,
  track: Track,
): Promise<boolean> {
  const room = roomManager.getRoom(roomId)
  if (!room) return false

  let resolved = { ...track }

  // Fetch stream URL if missing
  if (!resolved.streamUrl) {
    try {
      const url = await musicProvider.getStreamUrl(resolved.source, resolved.urlId)
      if (!url) {
        log(`Cannot get stream URL for "${resolved.title}", skipping`)
        io.to(roomId).emit(EVENTS.ROOM_ERROR, {
          message: `无法获取「${resolved.title}」的播放链接，已跳过`,
        })
        return false
      }
      resolved.streamUrl = url
    } catch (err) {
      logError(`getStreamUrl failed for ${resolved.urlId}:`, err)
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

  roomManager.setCurrentTrack(roomId, resolved)

  io.to(roomId).emit(EVENTS.PLAYER_PLAY, {
    track: resolved,
    playState: room.playState,
  })

  log(`Playing: ${resolved.title} in room ${roomId}`)
  return true
}
