import { ERROR_CODE, EVENTS, playerSetModeSchema } from '@music-together/shared'
import type { VoteAction } from '@music-together/shared'
import { roomRepo } from '../repositories/roomRepository.js'
import type { TypedServer } from '../middleware/types.js'
import { logger } from '../utils/logger.js'
import * as playerService from './playerService.js'
import * as queueService from './queueService.js'
import { toPublicRoomState } from '../utils/roomUtils.js'

/** Execute a player or queue action approved by the room vote. */
export async function executeVoteAction(
  io: TypedServer,
  roomId: string,
  action: VoteAction,
  payload?: Record<string, unknown>,
): Promise<boolean> {
  switch (action) {
    case 'pause':
      playerService.pauseTrack(io, roomId)
      return true
    case 'resume':
      playerService.resumeTrack(io, roomId)
      return true
    case 'next':
    case 'prev': {
      const room = roomRepo.get(roomId)
      if (!room) return false
      const trackId = typeof payload?.trackId === 'string' ? payload.trackId : undefined
      if (trackId !== undefined && playerService.getLatestPlayback(room).track?.id !== trackId) return false
      const options = { skipDebounce: true, expectedTrackId: trackId }
      if (action === 'next') await playerService.playNextTrackInRoom(io, roomId, room.playMode, options)
      else await playerService.playPrevTrackInRoom(io, roomId, options)
      return true
    }
    case 'set-mode': {
      const parsed = playerSetModeSchema.safeParse(payload)
      if (!parsed.success) {
        io.to(roomId).emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.INVALID_INPUT, message: '无效的播放模式' })
        return false
      }
      const room = roomRepo.get(roomId)
      if (!room) return false
      room.playMode = parsed.data.mode
      io.to(roomId).emit(EVENTS.ROOM_STATE, toPublicRoomState(room))
      logger.info(`Play mode set to ${parsed.data.mode} via vote`, { roomId })
      return true
    }
    case 'play-track': {
      const trackId = payload?.trackId
      if (typeof trackId !== 'string') {
        io.to(roomId).emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.INVALID_INPUT, message: '无效的歌曲 ID' })
        return false
      }
      const room = roomRepo.get(roomId)
      const track = room?.queue.find((item) => item.id === trackId)
      if (!track) {
        io.to(roomId).emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.INVALID_INPUT, message: '歌曲不在播放列表中' })
        return false
      }
      const played = await playerService.playTrackInRoom(io, roomId, track)
      if (played) logger.info(`Play-track executed for track ${trackId}`, { roomId })
      return played
    }
    case 'remove-track': {
      const trackId = payload?.trackId
      if (typeof trackId !== 'string') {
        io.to(roomId).emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.INVALID_INPUT, message: '无效的歌曲 ID' })
        return false
      }
      const room = roomRepo.get(roomId)
      if (!room || !room.queue.some((item) => item.id === trackId)) return false
      const effectiveTrack = room.pendingPlayback?.track ?? room.currentTrack
      const isCurrentTrack = effectiveTrack?.id === trackId
      const successor = isCurrentTrack ? queueService.getSuccessorAfterRemoval(roomId, trackId, room.playMode) : null
      queueService.removeTrack(roomId, trackId)
      io.to(roomId).emit(EVENTS.QUEUE_UPDATED, { queue: room.queue })
      if (isCurrentTrack) {
        if (successor) await playerService.playTrackInRoom(io, roomId, successor)
        else playerService.stopPlayback(io, roomId)
      }
      logger.info(`Remove-track executed for track ${trackId}`, { roomId })
      return true
    }
  }
}
