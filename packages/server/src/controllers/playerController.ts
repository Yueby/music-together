import { EVENTS } from '@music-together/shared'
import { config } from '../config.js'
import { roomRepo } from '../repositories/roomRepository.js'
import * as playerService from '../services/playerService.js'
import * as queueService from '../services/queueService.js'
import { estimateCurrentTime } from '../services/syncService.js'
import { createWithControl } from '../middleware/withControl.js'
import type { TypedServer, TypedSocket } from '../middleware/types.js'

// Debounce tracking for PLAYER_NEXT per room (entries are cleaned by cleanupRoom)
const lastNextTimestamp = new Map<string, number>()

/** Remove debounce entry for a deleted room */
export function cleanupRoom(roomId: string): void {
  lastNextTimestamp.delete(roomId)
}

export function registerPlayerController(io: TypedServer, socket: TypedSocket) {
  const withControl = createWithControl(io)

  socket.on(
    EVENTS.PLAYER_PLAY,
    withControl(async (ctx, data) => {
      const track = data?.track ?? ctx.room.currentTrack ?? ctx.room.queue[0]
      if (!track) return

      // Resume: same track already loaded and has stream URL → keep position
      if (!data?.track && ctx.room.currentTrack?.id === track.id && ctx.room.currentTrack?.streamUrl) {
        playerService.resumeTrack(ctx.io, ctx.roomId)
        return
      }

      await playerService.playTrackInRoom(ctx.io, ctx.roomId, track)
    }),
  )

  socket.on(
    EVENTS.PLAYER_PAUSE,
    withControl((ctx) => {
      playerService.pauseTrack(ctx.io, ctx.roomId)
    }),
  )

  socket.on(
    EVENTS.PLAYER_SEEK,
    withControl((ctx, data) => {
      const time = data?.currentTime
      if (typeof time !== 'number' || !isFinite(time) || time < 0) return
      playerService.seekTrack(ctx.io, ctx.roomId, time)
    }),
  )

  socket.on(
    EVENTS.PLAYER_NEXT,
    withControl(async (ctx) => {
      // Debounce: ignore if another NEXT was processed recently for this room
      const now = Date.now()
      const lastNext = lastNextTimestamp.get(ctx.roomId) ?? 0
      if (now - lastNext < config.player.nextDebounceMs) return
      lastNextTimestamp.set(ctx.roomId, now)

      const nextTrack = queueService.getNextTrack(ctx.roomId)
      if (!nextTrack) {
        playerService.setCurrentTrack(ctx.roomId, null)
        ctx.io.to(ctx.roomId).emit(EVENTS.PLAYER_PAUSE, {
          playState: { isPlaying: false, currentTime: 0, serverTimestamp: Date.now() },
        })
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
    withControl(async (ctx) => {
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

  // Host reports real playback position (hybrid sync calibration)
  socket.on(EVENTS.PLAYER_SYNC, ({ currentTime }) => {
    const mapping = roomRepo.getSocketMapping(socket.id)
    if (!mapping) return
    const room = roomRepo.get(mapping.roomId)
    if (!room) return
    // Only accept reports from the host
    if (room.hostId !== socket.id) return

    room.playState = { ...room.playState, currentTime, serverTimestamp: Date.now() }
  })

  socket.on(EVENTS.PLAYER_SYNC_REQUEST, () => {
    const mapping = roomRepo.getSocketMapping(socket.id)
    if (!mapping) return
    const room = roomRepo.get(mapping.roomId)
    if (!room) return

    socket.emit(EVENTS.PLAYER_SYNC_RESPONSE, {
      currentTime: estimateCurrentTime(mapping.roomId),
      isPlaying: room.playState.isPlaying,
      serverTimestamp: Date.now(),
    })
  })
}
