import { EVENTS } from '@music-together/shared'
import type { TypedServer, TypedSocket } from '../middleware/types.js'
import { createWithControl } from '../middleware/withControl.js'
import * as chatService from '../services/chatService.js'
import * as playerService from '../services/playerService.js'
import * as queueService from '../services/queueService.js'
import { logger } from '../utils/logger.js'

export function registerQueueController(io: TypedServer, socket: TypedSocket) {
  const withControl = createWithControl(io)

  socket.on(
    EVENTS.QUEUE_ADD,
    withControl(async (ctx, { track }) => {
      // Validate track shape
      if (
        !track ||
        typeof track.id !== 'string' ||
        typeof track.title !== 'string' ||
        typeof track.sourceId !== 'string'
      ) {
        socket.emit(EVENTS.ROOM_ERROR, { code: 'INVALID_DATA', message: '无效的歌曲数据' })
        return
      }

      const wasEmpty = !ctx.room.currentTrack

      // Inject requester nickname
      track.requestedBy = ctx.user.nickname

      const added = queueService.addTrack(ctx.roomId, track)
      if (!added) {
        socket.emit(EVENTS.ROOM_ERROR, { code: 'QUEUE_FULL', message: '播放队列已满' })
        return
      }
      io.to(ctx.roomId).emit(EVENTS.QUEUE_UPDATED, { queue: ctx.room.queue })

      // System message
      const msg = chatService.createSystemMessage(
        ctx.roomId,
        `${ctx.user.nickname} 点了一首「${track.title}」`,
      )
      io.to(ctx.roomId).emit(EVENTS.CHAT_MESSAGE, msg)

      // If nothing was playing, auto-play this track
      if (wasEmpty) {
        await playerService.playTrackInRoom(io, ctx.roomId, track)
      }

      logger.info(`Track added: ${track.title}`, { roomId: ctx.roomId })
    }),
  )

  socket.on(
    EVENTS.QUEUE_REMOVE,
    withControl(async (ctx, { trackId }) => {
      const isCurrentTrack = ctx.room.currentTrack?.id === trackId

      queueService.removeTrack(ctx.roomId, trackId)
      io.to(ctx.roomId).emit(EVENTS.QUEUE_UPDATED, { queue: ctx.room.queue })

      // If the removed track was currently playing, skip to next or stop
      if (isCurrentTrack) {
        const nextTrack = queueService.getNextTrack(ctx.roomId)
        if (nextTrack) {
          await playerService.playTrackInRoom(io, ctx.roomId, nextTrack)
        } else {
          playerService.setCurrentTrack(ctx.roomId, null)
          io.to(ctx.roomId).emit(EVENTS.PLAYER_PAUSE, {
            playState: { isPlaying: false, currentTime: 0, serverTimestamp: Date.now() },
          })
        }
      }

      logger.info(`Track removed`, { roomId: ctx.roomId })
    }),
  )

  socket.on(
    EVENTS.QUEUE_REORDER,
    withControl((ctx, { trackIds }) => {
      queueService.reorderTracks(ctx.roomId, trackIds)
      io.to(ctx.roomId).emit(EVENTS.QUEUE_UPDATED, { queue: ctx.room.queue })
      logger.info(`Queue reordered`, { roomId: ctx.roomId })
    }),
  )
}
