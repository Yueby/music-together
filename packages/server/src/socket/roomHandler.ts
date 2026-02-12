import type { Server, Socket } from 'socket.io'
import { EVENTS } from '@music-together/shared'
import * as roomManager from '../services/roomManager.js'
import { estimateCurrentTime } from './syncEngine.js'
import { log } from '../utils/logger.js'

export function registerRoomHandlers(io: Server, socket: Socket) {
  socket.on(EVENTS.ROOM_CREATE, ({ nickname }: { nickname: string }) => {
    const { room, user } = roomManager.createRoom(socket.id, nickname)
    socket.join(room.id)
    socket.emit(EVENTS.ROOM_CREATED, { roomId: room.id, userId: user.id })
    socket.emit(EVENTS.ROOM_STATE, room)
    log(`Room created: ${room.id} by ${nickname}`)
  })

  socket.on(EVENTS.ROOM_JOIN, ({ roomId, nickname }: { roomId: string; nickname: string }) => {
    const result = roomManager.joinRoom(socket.id, roomId, nickname)
    if (!result) {
      socket.emit(EVENTS.ROOM_ERROR, { code: 'ROOM_NOT_FOUND', message: '房间不存在' })
      return
    }

    const { room, user } = result
    socket.join(roomId)

    // Send full room state to the joining user
    socket.emit(EVENTS.ROOM_STATE, room)

    // Send chat history
    const chatHistory = roomManager.getChatHistory(roomId)
    socket.emit(EVENTS.CHAT_HISTORY, chatHistory)

    // If there's a track currently playing, send PLAYER_PLAY so the new user's
    // usePlayer hook auto-loads and plays from the current position.
    if (room.currentTrack?.streamUrl) {
      socket.emit(EVENTS.PLAYER_PLAY, {
        track: room.currentTrack,
        playState: {
          isPlaying: room.playState.isPlaying,
          currentTime: estimateCurrentTime(roomId),
          serverTimestamp: Date.now(),
        },
      })
    }

    // Notify others
    socket.to(roomId).emit(EVENTS.ROOM_USER_JOINED, user)
    log(`User ${nickname} joined room ${roomId}`)
  })

  socket.on(EVENTS.ROOM_LEAVE, () => {
    handleDisconnect(io, socket)
  })

  socket.on(EVENTS.ROOM_SETTINGS, (settings: { mode: 'host-only' | 'collaborative' }) => {
    const mapping = roomManager.getRoomBySocket(socket.id)
    if (!mapping) return

    const { roomId, room } = mapping
    // Only host can change settings
    if (room.hostId !== socket.id) return

    roomManager.updateRoomSettings(roomId, settings)
    io.to(roomId).emit(EVENTS.ROOM_SETTINGS, { mode: settings.mode })
    log(`Room ${roomId} settings updated: ${settings.mode}`)
  })

  socket.on('disconnect', () => {
    handleDisconnect(io, socket)
  })
}

function handleDisconnect(io: Server, socket: Socket) {
  const result = roomManager.leaveRoom(socket.id)
  if (!result) return

  const { roomId, user } = result
  socket.leave(roomId)
  io.to(roomId).emit(EVENTS.ROOM_USER_LEFT, user)
  log(`User ${user.nickname} left room ${roomId}`)
}
