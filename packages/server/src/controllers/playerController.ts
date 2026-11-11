import { EVENTS, ERROR_CODE, defineAbilityFor, ntpPingSchema, playerPlaySchema, playerSeekSchema, playerSetModeSchema, playerSyncSchema } from '@music-together/shared'
import type { TypedServer, TypedSocket } from '../middleware/types.js'
import { createWithPermission } from '../middleware/withControl.js'
import { createWithRoom } from '../middleware/withRoom.js'
import { checkSocketRateLimit } from '../middleware/socketRateLimiter.js'
import { roomRepo } from '../repositories/roomRepository.js'
import * as playerService from '../services/playerService.js'
import * as roomService from '../services/roomService.js'
import { resolveConductorSampleTimestamp } from '../services/conductorSample.js'
import { estimateCurrentTime } from '../services/syncService.js'
import { logger } from '../utils/logger.js'

export function registerPlayerController(io: TypedServer, socket: TypedSocket) {
  const withPermission = createWithPermission(io)

  socket.on(
    EVENTS.PLAYER_PLAY,
    withPermission('play', 'Player', async (ctx, raw) => {
      if (!(await checkSocketRateLimit(ctx.socket))) return
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

  // Conductor (hostId) auto-next bypasses CASL — system behavior, not manual user action.
  // Non-conductor manual next still requires CASL permission check.
  const withRoom = createWithRoom(io)
  socket.on(
    EVENTS.PLAYER_NEXT,
    withRoom(async (ctx) => {
      if (ctx.user.id !== ctx.room.hostId) {
        const ability = defineAbilityFor(ctx.user.role)
        if (!ability.can('next', 'Player')) {
          ctx.socket.emit(EVENTS.ROOM_ERROR, {
            code: ERROR_CODE.NO_PERMISSION,
            message: '你没有权限执行此操作',
          })
          return
        }
      }
      await playerService.playNextTrackInRoom(ctx.io, ctx.roomId, ctx.room.playMode)
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

  // Conductor reports real playback position (keeps server-side playState accurate
  // for mid-song joiners and reconnection recovery — no forwarding to clients)
  socket.on(EVENTS.PLAYER_SYNC, (raw) => {
    try {
      const parsed = playerSyncSchema.safeParse(raw)
      if (!parsed.success) return
      const mapping = roomRepo.getSocketMapping(socket.id)
      if (!mapping) return
      const room = roomRepo.get(mapping.roomId)
      if (!room?.currentTrack || room.pendingPlayback) return
      // Only the elected conductor socket may write playback progress. A user
      // can have multiple tabs, but only the most recently elected socket owns
      // the authoritative clock.
      if (room.hostId !== mapping.userId || room.conductorSocketId !== socket.id) return

      if (parsed.data.revision !== room.playState.revision || parsed.data.trackId !== room.currentTrack.id) return

      const duration = room.currentTrack.duration
      const currentTime = duration > 0 ? Math.min(parsed.data.currentTime, duration) : parsed.data.currentTime

      // Reject stale reports from a sleeping conductor: if the reported position is
      // far behind the server's estimate, the conductor likely just woke from sleep
      // and hasn't drift-corrected yet.  Accepting this would poison the server
      // state and cause all other clients to seek backwards.
      if (room.playState.isPlaying) {
        const estimated = estimateCurrentTime(mapping.roomId)
        if (!playerService.validateConductorReport(mapping.roomId, currentTime, estimated)) {
          return
        }
      }

      // Keep the media sample and its timestamp on the same time axis. The
      // conductor sampled currentTime at hostServerTime; anchoring that older
      // position at server receive time introduces a fixed follower lag. Do
      // not add the timestamp delta to currentTime either — retain the exact
      // historical zero-drift model and let estimateCurrentTime advance it.
      const serverNow = Date.now()
      const sampleTimestamp = resolveConductorSampleTimestamp(parsed.data.hostServerTime, serverNow)
      room.playState = {
        ...room.playState,
        currentTime,
        serverTimestamp: sampleTimestamp,
      }
    } catch (err) {
      // Sync is best-effort; log but don't emit error to avoid noise
      logger.error('PLAYER_SYNC handler error', err, { socketId: socket.id })
    }
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
