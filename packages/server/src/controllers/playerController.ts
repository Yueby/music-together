import { EVENTS, ERROR_CODE, ntpPingSchema, playerNextSchema, playerPlaySchema, playerReadySchema, playerSeekSchema, playerSetModeSchema, playerSyncSchema } from '@music-together/shared'
import type { HandlerContext, TypedServer, TypedSocket } from '../middleware/types.js'
import { createWithPermission, withRateLimitedPermission } from '../middleware/withControl.js'
import { createWithRoom } from '../middleware/withRoom.js'
import { roomRepo } from '../repositories/roomRepository.js'
import * as playerService from '../services/playerService.js'
import * as roomService from '../services/roomService.js'
import { estimateCurrentTime } from '../services/syncService.js'
import { baseLogger, logger } from '../utils/logger.js'

export function registerPlayerController(io: TypedServer, socket: TypedSocket) {
  const withPermission = createWithPermission(io)

  socket.on(
    EVENTS.PLAYER_PLAY,
    withPermission('play', 'Player', async (ctx, raw) => {
      const parsed = playerPlaySchema.safeParse(raw ?? undefined)
      if (!parsed.success) {
        ctx.socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.INVALID_DATA, message: '无效的播放请求' })
        return
      }
      const data = parsed.data
      // A requested track is looked up in the queue by id; what the client says about it beyond that is not used.
      const requestedId = data?.track?.id
      const requested = requestedId ? ctx.room.queue.find((t) => t.id === requestedId) : undefined
      if (requestedId && !requested) return
      const track = requested ?? ctx.room.currentTrack ?? ctx.room.queue[0]
      if (!track) return

      // Resume: same track already loaded and has stream URL → keep position
      if (!requested &&ctx.room.currentTrack?.id === track.id && ctx.room.currentTrack?.streamUrl) {
        playerService.resumeTrack(ctx.io, ctx.roomId, ctx.socket)
        return
      }

      await playerService.playTrackInRoom(ctx.io, ctx.roomId, track)
    }),
  )

  socket.on(
    EVENTS.PLAYER_PAUSE,
    withPermission('pause', 'Player', (ctx) => {
      playerService.pauseTrack(ctx.io, ctx.roomId, ctx.socket)
    }),
  )

  socket.on(
    EVENTS.PLAYER_SEEK,
    withPermission('seek', 'Player', (ctx, data) => {
      const parsed = playerSeekSchema.safeParse(data)
      if (!parsed.success) return
      playerService.seekTrack(ctx.io, ctx.roomId, parsed.data.currentTime, ctx.socket)
    }),
  )

  const withRoom = createWithRoom(io)
  const manualNext = withRateLimitedPermission('play', 'Player', async (ctx: HandlerContext) => {
    await playerService.playNextTrackInRoom(ctx.io, ctx.roomId, ctx.room.playMode)
  })
  socket.on(
    EVENTS.PLAYER_NEXT,
    withRoom(async (ctx, raw) => {
      const parsed = playerNextSchema.safeParse(raw)
      if (!parsed.success) {
        ctx.socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.INVALID_DATA, message: '无效的切歌请求' })
        return
      }
      const data = parsed.data
      if (!data?.auto) return manualNext(ctx, undefined)

      const { currentTrack, playState } = ctx.room
      if (!currentTrack || !playState.isPlaying || currentTrack.id !== data.trackId || playState.revision !== data.revision) return
      if (currentTrack.duration > 0) {
        if (estimateCurrentTime(ctx.roomId) < Math.max(0, currentTrack.duration - 5)) return
      } else if (ctx.user.id !== ctx.room.hostId || ctx.socket.id !== ctx.room.conductorSocketId) {
        return
      }

      await playerService.playNextTrackInRoom(ctx.io, ctx.roomId, ctx.room.playMode, {
        expectedTrackId: currentTrack.id,
        expectedRevision: playState.revision,
        skipDebounce: true,
      })
    }),
  )

  socket.on(
    EVENTS.PLAYER_READY,
    withRoom((ctx, raw) => {
      const parsed = playerReadySchema.safeParse(raw)
      if (!parsed.success) return
      const { trackId, revision, failed } = parsed.data
      playerService.markClientReady(ctx.io, ctx.roomId, ctx.socket.id, trackId, revision, failed)
    }),
  )

  socket.on(
    EVENTS.PLAYER_PREV,
    withPermission('prev', 'Player', async (ctx) => {
      await playerService.playPrevTrackInRoom(ctx.io, ctx.roomId)
    }),
  )

  socket.on(
    EVENTS.PLAYER_SET_MODE,
    withPermission('set-mode', 'Player', (ctx, data) => {
      const parsed = playerSetModeSchema.safeParse(data)
      if (!parsed.success) return
      ctx.room.playMode = parsed.data.mode
      // Broadcast updated room state so all clients see the new play mode
      ctx.io.to(ctx.roomId).emit(EVENTS.ROOM_STATE, roomService.toPublicRoomState(ctx.room))
      // The mode decides what comes next (and whether it is known in advance).
      void playerService.preloadUpcoming(ctx.io, ctx.roomId)
      logger.info(`Play mode set to ${parsed.data.mode}`, {
        roomId: ctx.roomId,
      })
    }),
  )

  // ---------------------------------------------------------------------------
  // NTP clock synchronisation – reply instantly with server time
  // ---------------------------------------------------------------------------
  socket.on(EVENTS.NTP_PING, (raw) => {
    try {
      // A malformed ping still gets its answer (the clock sync must not stall), but nothing from it is kept.
      const parsed = ntpPingSchema.safeParse(raw)
      const data = parsed.success ? parsed.data : undefined

      // Store client-reported RTT for adaptive scheduling delay
      if (data?.lastRttMs !== undefined) {
        roomRepo.setSocketRTT(socket.id, data.lastRttMs)
      }

      socket.emit(EVENTS.NTP_PONG, {
        clientPingId: data?.clientPingId ?? 0,
        serverTime: Date.now(),
      })
    } catch (err) {
      logger.error('NTP_PING handler error', err, { socketId: socket.id })
    }
  })

  // Older clients still send position reports. The server clock drives playback.
  socket.on(EVENTS.PLAYER_SYNC, (raw) => {
    if (!playerSyncSchema.safeParse(raw).success) return
    const mapping = roomRepo.getSocketMapping(socket.id)
    if (!mapping || !roomRepo.get(mapping.roomId)?.users.some((user) => user.id === mapping.userId)) return
    baseLogger.debug({ roomId: mapping.roomId, socketId: socket.id }, 'Received legacy playback report')
  })

  socket.on(EVENTS.PLAYER_SYNC_REQUEST, () => {
    try {
      const mapping = roomRepo.getSocketMapping(socket.id)
      if (!mapping) return
      const room = roomRepo.get(mapping.roomId)
      if (!room) return

      socket.emit(EVENTS.PLAYER_SYNC_RESPONSE, {
        currentTime: estimateCurrentTime(mapping.roomId),
        isPlaying: room.playState.isPlaying,
        serverTimestamp: Date.now(),
        // Lets the client drop in-flight responses that raced a track change.
        trackId: room.currentTrack?.id ?? null,
      })
    } catch (err) {
      logger.error('PLAYER_SYNC_REQUEST handler error', err, {
        socketId: socket.id,
      })
    }
  })
}
