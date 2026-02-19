import {
  EVENTS,
  ERROR_CODE,
  queueAddSchema,
  queueAddBatchSchema,
  queueRemoveSchema,
  queueReorderSchema,
} from '@music-together/shared'
import type { Track } from '@music-together/shared'
import type { TypedServer, TypedSocket } from '../middleware/types.js'
import { createWithPermission } from '../middleware/withControl.js'
import { checkSocketRateLimit } from '../middleware/socketRateLimiter.js'
import * as chatService from '../services/chatService.js'
import * as playerService from '../services/playerService.js'
import * as queueService from '../services/queueService.js'
import { logger } from '../utils/logger.js'

export function registerQueueController(io: TypedServer, socket: TypedSocket) {
  const withPermission = createWithPermission(io)

  socket.on(
    EVENTS.QUEUE_ADD,
    withPermission('add', 'Queue', async (ctx, raw) => {
      if (!(await checkSocketRateLimit(ctx.socket))) return
      const parsed = queueAddSchema.safeParse(raw)
      if (!parsed.success) {
        socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.INVALID_DATA, message: '无效的歌曲数据' })
        return
      }
      const track: Track = { ...parsed.data.track, requestedBy: ctx.user.nickname }

      const added = queueService.addTrack(ctx.roomId, track)
      if (!added) {
        socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.QUEUE_FULL, message: '播放队列已满' })
        return
      }
      io.to(ctx.roomId).emit(EVENTS.QUEUE_UPDATED, { queue: ctx.room.queue })

      // System message
      const msg = chatService.createSystemMessage(ctx.roomId, `${ctx.user.nickname} 点了一首「${track.title}」`)
      io.to(ctx.roomId).emit(EVENTS.CHAT_MESSAGE, msg)

      // If nothing was playing, auto-play this track.
      // Uses autoPlayIfEmpty which re-checks room.currentTrack inside the
      // per-room mutex, preventing concurrent QUEUE_ADD handlers from both
      // triggering playback.
      await playerService.autoPlayIfEmpty(io, ctx.roomId, track)

      logger.info(`Track added: ${track.title}`, { roomId: ctx.roomId })
    }),
  )

  socket.on(
    EVENTS.QUEUE_ADD_BATCH,
    withPermission('add', 'Queue', async (ctx, raw) => {
      if (!(await checkSocketRateLimit(ctx.socket))) return
      const parsed = queueAddBatchSchema.safeParse(raw)
      if (!parsed.success) {
        socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.INVALID_DATA, message: '无效的歌曲数据' })
        return
      }
      const { tracks: rawTracks, playlistName } = parsed.data
      const tracks: Track[] = rawTracks.map((t) => ({ ...t, requestedBy: ctx.user.nickname }))

      const addedCount = queueService.addBatchTracks(ctx.roomId, tracks)
      if (addedCount === 0) {
        socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.QUEUE_FULL, message: '播放队列已满' })
        return
      }
      io.to(ctx.roomId).emit(EVENTS.QUEUE_UPDATED, { queue: ctx.room.queue })

      const label = playlistName ? `歌单「${playlistName}」` : '歌单'
      const msg = chatService.createSystemMessage(
        ctx.roomId,
        `${ctx.user.nickname} 从${label}导入了 ${addedCount} 首歌`,
      )
      io.to(ctx.roomId).emit(EVENTS.CHAT_MESSAGE, msg)

      // Auto-play first added track if nothing is playing
      if (addedCount > 0) {
        await playerService.autoPlayIfEmpty(io, ctx.roomId, tracks[0])
      }

      logger.info(`Batch added ${addedCount} tracks from playlist`, { roomId: ctx.roomId })
    }),
  )

  socket.on(
    EVENTS.QUEUE_REMOVE,
    withPermission('remove', 'Queue', async (ctx, raw) => {
      const parsed = queueRemoveSchema.safeParse(raw)
      if (!parsed.success) {
        socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.INVALID_DATA, message: '无效的移除请求' })
        return
      }
      const { trackId } = parsed.data
      const isCurrentTrack = ctx.room.currentTrack?.id === trackId

      queueService.removeTrack(ctx.roomId, trackId)
      io.to(ctx.roomId).emit(EVENTS.QUEUE_UPDATED, { queue: ctx.room.queue })

      // If the removed track was currently playing, skip to next or stop.
      // skipDebounce: removing current track must always advance, regardless
      // of how recently the last NEXT was triggered.
      if (isCurrentTrack) {
        await playerService.playNextTrackInRoom(io, ctx.roomId, ctx.room.playMode, { skipDebounce: true })
      }

      logger.info(`Track removed`, { roomId: ctx.roomId })
    }),
  )

  socket.on(
    EVENTS.QUEUE_REORDER,
    withPermission('reorder', 'Queue', (ctx, raw) => {
      const parsed = queueReorderSchema.safeParse(raw)
      if (!parsed.success) {
        socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.INVALID_DATA, message: '无效的排序数据' })
        return
      }
      const { trackIds } = parsed.data
      queueService.reorderTracks(ctx.roomId, trackIds)
      io.to(ctx.roomId).emit(EVENTS.QUEUE_UPDATED, { queue: ctx.room.queue })
      logger.info(`Queue reordered`, { roomId: ctx.roomId })
    }),
  )

  socket.on(
    EVENTS.QUEUE_CLEAR,
    withPermission('remove', 'Queue', async (ctx) => {
      queueService.clearQueue(ctx.roomId)
      io.to(ctx.roomId).emit(EVENTS.QUEUE_UPDATED, { queue: [] })

      // Stop playback via mutex-protected variant to prevent races with
      // concurrent autoPlayIfEmpty from a simultaneous QUEUE_ADD.
      await playerService.stopPlaybackSafe(io, ctx.roomId)

      logger.info(`Queue cleared`, { roomId: ctx.roomId })
    }),
  )
}
