import { EVENTS, playerSeekSchema, playerSetModeSchema, playerSyncSchema } from '@music-together/shared'
import type { TypedServer, TypedSocket } from '../middleware/types.js'
import { createWithPermission } from '../middleware/withControl.js'
import { roomRepo } from '../repositories/roomRepository.js'
import * as playerService from '../services/playerService.js'
import * as queueService from '../services/queueService.js'
import * as roomService from '../services/roomService.js'
import { estimateCurrentTime } from '../services/syncService.js'
import { logger } from '../utils/logger.js'

/** Track consecutive rejected host reports per room to break deadlocks */
const hostRejectCount = new Map<string, number>()
const HOST_REJECT_FORCE_ACCEPT = 3

export function registerPlayerController(io: TypedServer, socket: TypedSocket) {
  const withPermission = createWithPermission(io)

  socket.on(
    EVENTS.PLAYER_PLAY,
    withPermission('play', 'Player', async (ctx, data) => {
      const track = data?.track ?? ctx.room.currentTrack ?? ctx.room.queue[0]
      if (!track) return

      // Resume: same track already loaded and has stream URL → keep position
      if (!data?.track && ctx.room.currentTrack?.id === track.id && ctx.room.currentTrack?.streamUrl) {
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

  socket.on(
    EVENTS.PLAYER_NEXT,
    withPermission('next', 'Player', async (ctx) => {
      // Debounce: ignore if another NEXT was processed recently for this room
      if (playerService.isNextDebounced(ctx.roomId)) return

      const nextTrack = queueService.getNextTrack(ctx.roomId, ctx.room.playMode)
      if (!nextTrack) {
        playerService.stopPlayback(ctx.io, ctx.roomId)
        return
      }

      const success = await playerService.playTrackInRoom(ctx.io, ctx.roomId, nextTrack)

      // If stream URL failed, try the next one after that
      if (!success) {
        const skipTrack = queueService.getNextTrack(ctx.roomId, ctx.room.playMode)
        if (skipTrack) {
          await playerService.playTrackInRoom(ctx.io, ctx.roomId, skipTrack)
        }
      }
    }),
  )

  socket.on(
    EVENTS.PLAYER_PREV,
    withPermission('prev', 'Player', async (ctx) => {
      if (playerService.isNextDebounced(ctx.roomId)) return

      const prevTrack = queueService.getPreviousTrack(ctx.roomId)
      if (!prevTrack) return // already at the start, do nothing

      const success = await playerService.playTrackInRoom(ctx.io, ctx.roomId, prevTrack)

      if (!success) {
        const skipTrack = queueService.getPreviousTrack(ctx.roomId)
        if (skipTrack) {
          await playerService.playTrackInRoom(ctx.io, ctx.roomId, skipTrack)
        }
      }
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
      logger.info(`Play mode set to ${parsed.data.mode}`, { roomId: ctx.roomId })
    }),
  )

  // ---------------------------------------------------------------------------
  // NTP clock synchronisation – reply instantly with server time
  // ---------------------------------------------------------------------------
  socket.on(EVENTS.NTP_PING, (data) => {
    try {
      // Store client-reported RTT for adaptive scheduling delay
      if (data?.lastRttMs != null && data.lastRttMs > 0 && data.lastRttMs <= 10_000) {
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

  // Host reports real playback position (keeps server-side playState accurate
  // for mid-song joiners and reconnection recovery — no forwarding to clients)
  socket.on(EVENTS.PLAYER_SYNC, (raw) => {
    try {
      const parsed = playerSyncSchema.safeParse(raw)
      if (!parsed.success) return
      const { currentTime } = parsed.data

      const mapping = roomRepo.getSocketMapping(socket.id)
      if (!mapping) return
      const room = roomRepo.get(mapping.roomId)
      if (!room) return
      // Only accept reports from the host
      if (room.hostId !== mapping.userId) return

      // Reject stale reports from a sleeping host: if the reported position is
      // far behind the server's estimate, the host likely just woke from sleep
      // and hasn't drift-corrected yet.  Accepting this would poison the server
      // state and cause all other clients to seek backwards.
      if (room.playState.isPlaying) {
        const estimated = estimateCurrentTime(mapping.roomId)
        if (estimated - currentTime > 1) {
          const count = (hostRejectCount.get(mapping.roomId) ?? 0) + 1
          hostRejectCount.set(mapping.roomId, count)
          if (count < HOST_REJECT_FORCE_ACCEPT) {
            // Still within tolerance — reject this report
            return
          }
          // Too many consecutive rejections — force accept to break deadlock.
          // The server estimate has likely diverged from reality.
          logger.warn(`Force-accepting host report after ${count} consecutive rejections`, { roomId: mapping.roomId })
        }
      }

      // Report accepted — reset rejection counter
      hostRejectCount.delete(mapping.roomId)
      room.playState = { ...room.playState, currentTime, serverTimestamp: Date.now() }
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
      })
    } catch (err) {
      logger.error('PLAYER_SYNC_REQUEST handler error', err, { socketId: socket.id })
    }
  })
}
