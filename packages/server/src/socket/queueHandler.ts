import type { Server, Socket } from 'socket.io'
import { EVENTS } from '@music-together/shared'
import type { Track } from '@music-together/shared'
import * as roomManager from '../services/roomManager.js'
import { log } from '../utils/logger.js'
import { playTrackInRoom } from './playTrack.js'

export function registerQueueHandlers(io: Server, socket: Socket) {
  socket.on(EVENTS.QUEUE_ADD, async ({ track }: { track: Track }) => {
    if (!roomManager.canUserControl(socket.id)) {
      socket.emit(EVENTS.ROOM_ERROR, { message: '无法操作：你不在房间中或没有控制权限' })
      return
    }

    const mapping = roomManager.getRoomBySocket(socket.id)
    if (!mapping) {
      socket.emit(EVENTS.ROOM_ERROR, { message: '无法操作：未找到所在房间' })
      return
    }
    const { roomId, room } = mapping

    const wasEmpty = !room.currentTrack

    roomManager.addToQueue(roomId, track)
    io.to(roomId).emit(EVENTS.QUEUE_UPDATED, { queue: room.queue })

    // System message
    const user = roomManager.getUserBySocket(socket.id)
    if (user) {
      const msg = {
        id: crypto.randomUUID(),
        userId: 'system',
        nickname: 'system',
        content: `${user.nickname} 点了一首「${track.title}」`,
        timestamp: Date.now(),
        type: 'system' as const,
      }
      roomManager.addChatMessage(roomId, msg)
      io.to(roomId).emit(EVENTS.CHAT_MESSAGE, msg)
    }

    // If nothing was playing, auto-play this track (full flow with stream URL)
    if (wasEmpty) {
      await playTrackInRoom(io, roomId, track)
    }

    log(`Track added to queue: ${track.title} in room ${roomId}`)
  })

  socket.on(EVENTS.QUEUE_REMOVE, async ({ trackId }: { trackId: string }) => {
    if (!roomManager.canUserControl(socket.id)) {
      socket.emit(EVENTS.ROOM_ERROR, { message: '无法操作：没有控制权限' })
      return
    }

    const mapping = roomManager.getRoomBySocket(socket.id)
    if (!mapping) {
      socket.emit(EVENTS.ROOM_ERROR, { message: '无法操作：未找到所在房间' })
      return
    }
    const { roomId, room } = mapping

    const isCurrentTrack = room.currentTrack?.id === trackId

    roomManager.removeFromQueue(roomId, trackId)
    io.to(roomId).emit(EVENTS.QUEUE_UPDATED, { queue: room.queue })

    // If the removed track was currently playing, skip to next or stop
    if (isCurrentTrack) {
      const nextTrack = roomManager.getNextTrack(roomId)
      if (nextTrack) {
        await playTrackInRoom(io, roomId, nextTrack)
      } else {
        // No more tracks — stop playback
        roomManager.setCurrentTrack(roomId, null)
        roomManager.updateRoomPlayState(roomId, { isPlaying: false, currentTime: 0 })
        io.to(roomId).emit(EVENTS.PLAYER_PAUSE)
      }
    }

    log(`Track removed from queue in room ${roomId}`)
  })

  socket.on(EVENTS.QUEUE_REORDER, ({ trackIds }: { trackIds: string[] }) => {
    if (!roomManager.canUserControl(socket.id)) {
      socket.emit(EVENTS.ROOM_ERROR, { message: '无法操作：没有控制权限' })
      return
    }

    const mapping = roomManager.getRoomBySocket(socket.id)
    if (!mapping) {
      socket.emit(EVENTS.ROOM_ERROR, { message: '无法操作：未找到所在房间' })
      return
    }
    const { roomId, room } = mapping

    roomManager.reorderQueue(roomId, trackIds)
    io.to(roomId).emit(EVENTS.QUEUE_UPDATED, { queue: room.queue })
    log(`Queue reordered in room ${roomId}`)
  })
}
