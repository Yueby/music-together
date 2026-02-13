import { EVENTS, playerSeekSchema, playerSyncSchema } from '@music-together/shared'
import { config } from '../config.js'
import { roomRepo } from '../repositories/roomRepository.js'
import * as playerService from '../services/playerService.js'
import * as queueService from '../services/queueService.js'
import * as roomService from '../services/roomService.js'
import { estimateCurrentTime } from '../services/syncService.js'
import { createWithPermission } from '../middleware/withControl.js'
import { logger } from '../utils/logger.js'
import type { TypedServer, TypedSocket } from '../middleware/types.js'

// Debounce tracking for PLAYER_NEXT per room (entries are cleaned by cleanupRoom)
const lastNextTimestamp = new Map<string, number>()

/** Remove debounce entry for a deleted room */
export function cleanupRoom(roomId: string): void {
  lastNextTimestamp.delete(roomId)
}

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
      const now = Date.now()
      const lastNext = lastNextTimestamp.get(ctx.roomId) ?? 0
      if (now - lastNext < config.player.nextDebounceMs) return
      lastNextTimestamp.set(ctx.roomId, now)

      const nextTrack = queueService.getNextTrack(ctx.roomId)
      if (!nextTrack) {
        playerService.setCurrentTrack(ctx.roomId, null)
        ctx.io.to(ctx.roomId).emit(EVENTS.PLAYER_PAUSE, {
          playState: { isPlaying: false, currentTime: 0, serverTimestamp: Date.now(), serverTimeToExecute: Date.now() },
        })
        // 曲目清空，通知大厅刷新
        roomService.broadcastRoomList(ctx.io)
        return
      }

      const success = await playerService.playTrackInRoom(ctx.io, ctx.roomId, nextTrack)

      // If stream URL failed, try the next one after that
      if (!success) {
        const skipTrack = queueService.getNextTrack(ctx.roomId)
        if (skipTrack) {
          await playerService.playTrackInRoom(ctx.io, ctx.roomId, skipTrack)
        }
      }
    }),
  )

  socket.on(
    EVENTS.PLAYER_PREV,
    withPermission('prev', 'Player', async (ctx) => {
      const now = Date.now()
      const lastNext = lastNextTimestamp.get(ctx.roomId) ?? 0
      if (now - lastNext < config.player.nextDebounceMs) return
      lastNextTimestamp.set(ctx.roomId, now)

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

  // ---------------------------------------------------------------------------
  // NTP clock synchronisation – reply instantly with server time
  // ---------------------------------------------------------------------------
  socket.on(EVENTS.NTP_PING, (data) => {
    // Store client-reported RTT for adaptive scheduling delay
    if (data?.lastRttMs != null && data.lastRttMs > 0) {
      roomRepo.setSocketRTT(socket.id, data.lastRttMs)
    }

    socket.emit(EVENTS.NTP_PONG, {
      clientPingId: data?.clientPingId ?? 0,
      serverTime: Date.now(),
    })
  })

  // Host reports real playback position (hybrid sync calibration)
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
      if (room.hostId !== socket.id) return

      room.playState = { ...room.playState, currentTime, serverTimestamp: Date.now() }

      // 立即转发给房间内其他客户端（不含 host 自己）
      socket.to(mapping.roomId).emit(EVENTS.PLAYER_SYNC_RESPONSE, {
        currentTime,
        isPlaying: room.playState.isPlaying,
        serverTimestamp: Date.now(),
      })
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
