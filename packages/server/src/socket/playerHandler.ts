import type { Server, Socket } from 'socket.io'
import { EVENTS } from '@music-together/shared'
import type { Track } from '@music-together/shared'
import * as roomManager from '../services/roomManager.js'
import { log } from '../utils/logger.js'
import { estimateCurrentTime } from './syncEngine.js'
import { playTrackInRoom } from './playTrack.js'

// Debounce tracking for PLAYER_NEXT per room
const lastNextTimestamp = new Map<string, number>()
const NEXT_DEBOUNCE_MS = 2000

export function registerPlayerHandlers(io: Server, socket: Socket) {
  socket.on(EVENTS.PLAYER_PLAY, async (data?: { track?: Track }) => {
    if (!roomManager.canUserControl(socket.id)) return

    const mapping = roomManager.getRoomBySocket(socket.id)
    if (!mapping) return
    const { roomId, room } = mapping

    const track = data?.track ?? room.currentTrack
    if (!track) return

    await playTrackInRoom(io, roomId, track)
  })

  socket.on(EVENTS.PLAYER_PAUSE, () => {
    if (!roomManager.canUserControl(socket.id)) return

    const mapping = roomManager.getRoomBySocket(socket.id)
    if (!mapping) return
    const { roomId } = mapping

    roomManager.updateRoomPlayState(roomId, { isPlaying: false })
    io.to(roomId).emit(EVENTS.PLAYER_PAUSE)
  })

  socket.on(EVENTS.PLAYER_SEEK, ({ currentTime }: { currentTime: number }) => {
    if (!roomManager.canUserControl(socket.id)) return

    const mapping = roomManager.getRoomBySocket(socket.id)
    if (!mapping) return
    const { roomId } = mapping

    roomManager.updateRoomPlayState(roomId, { currentTime })
    io.to(roomId).emit(EVENTS.PLAYER_SEEK, { currentTime })
  })

  socket.on(EVENTS.PLAYER_NEXT, async () => {
    if (!roomManager.canUserControl(socket.id)) return

    const mapping = roomManager.getRoomBySocket(socket.id)
    if (!mapping) return
    const { roomId } = mapping

    // Debounce: ignore if another NEXT was processed < 2s ago for this room
    const now = Date.now()
    const lastNext = lastNextTimestamp.get(roomId) ?? 0
    if (now - lastNext < NEXT_DEBOUNCE_MS) return
    lastNextTimestamp.set(roomId, now)

    const nextTrack = roomManager.getNextTrack(roomId)
    if (!nextTrack) {
      roomManager.setCurrentTrack(roomId, null)
      roomManager.updateRoomPlayState(roomId, { isPlaying: false })
      io.to(roomId).emit(EVENTS.PLAYER_PAUSE)
      return
    }

    const success = await playTrackInRoom(io, roomId, nextTrack)

    // If stream URL failed, try the next one after that
    if (!success) {
      const skipTrack = roomManager.getNextTrack(roomId)
      if (skipTrack) {
        await playTrackInRoom(io, roomId, skipTrack)
      }
    }
  })

  // Host reports real playback position (hybrid sync calibration)
  socket.on(EVENTS.PLAYER_SYNC, ({ currentTime }: { currentTime: number }) => {
    const mapping = roomManager.getRoomBySocket(socket.id)
    if (!mapping) return
    const { roomId, room } = mapping

    // Only accept reports from the host
    if (room.hostId !== socket.id) return

    roomManager.updateRoomPlayState(roomId, { currentTime })
  })

  socket.on(EVENTS.PLAYER_SYNC_REQUEST, () => {
    const mapping = roomManager.getRoomBySocket(socket.id)
    if (!mapping) return
    const { roomId, room } = mapping

    socket.emit(EVENTS.PLAYER_SYNC_RESPONSE, {
      currentTime: estimateCurrentTime(roomId),
      isPlaying: room.playState.isPlaying,
      serverTimestamp: Date.now(),
    })
  })
}
