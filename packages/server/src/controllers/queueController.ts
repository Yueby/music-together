import { EVENTS, ERROR_CODE, queueAddSchema, queueRemoveSchema, queueReorderSchema } from '@music-together/shared'
import type { Track } from '@music-together/shared'
import type { TypedServer, TypedSocket } from '../middleware/types.js'
import { createWithPermission } from '../middleware/withControl.js'
import * as chatService from '../services/chatService.js'
import * as playerService from '../services/playerService.js'
import * as queueService from '../services/queueService.js'
import * as roomService from '../services/roomService.js'
import { logger } from '../utils/logger.js'

export function registerQueueController(io: TypedServer, socket: TypedSocket) {
  const withPermission = createWithPermission(io)

  socket.on(
    EVENTS.QUEUE_ADD,
    withPermission('add', 'Queue', async (ctx, raw) => {
      const parsed = queueAddSchema.safeParse(raw)
      if (!parsed.success) {
        socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.INVALID_DATA, message: '无效的歌曲数据' })
        return
      }
      const track: Track = { ...parsed.data.track, requestedBy: ctx.user.nickname }

      const wasEmpty = !ctx.room.currentTrack

      const added = queueService.addTrack(ctx.roomId, track)
      if (!added) {
        socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.QUEUE_FULL, message: '播放队列已满' })
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
    withPermission('remove', 'Queue', async (ctx, raw) => {
      const parsed = queueRemoveSchema.safeParse(raw)
      if (!parsed.success) return
      const { trackId } = parsed.data
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
            playState: { isPlaying: false, currentTime: 0, serverTimestamp: Date.now(), serverTimeToExecute: Date.now() },
          })
          // Broadcast full ROOM_STATE so clients clear the stale currentTrack
          const updatedRoom = roomService.getRoom(ctx.roomId)
          if (updatedRoom) {
            io.to(ctx.roomId).emit(EVENTS.ROOM_STATE, roomService.toPublicRoomState(updatedRoom))
          }
          // 曲目清空，通知大厅刷新
          roomService.broadcastRoomList(io)
        }
      }

      logger.info(`Track removed`, { roomId: ctx.roomId })
    }),
  )

  socket.on(
    EVENTS.QUEUE_REORDER,
    withPermission('reorder', 'Queue', (ctx, raw) => {
      const parsed = queueReorderSchema.safeParse(raw)
      if (!parsed.success) return
      const { trackIds } = parsed.data
      queueService.reorderTracks(ctx.roomId, trackIds)
      io.to(ctx.roomId).emit(EVENTS.QUEUE_UPDATED, { queue: ctx.room.queue })
      logger.info(`Queue reordered`, { roomId: ctx.roomId })
    }),
  )
}
