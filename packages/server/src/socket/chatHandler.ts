import type { Server, Socket } from 'socket.io'
import { EVENTS } from '@music-together/shared'
import * as roomManager from '../services/roomManager.js'

export function registerChatHandlers(io: Server, socket: Socket) {
  socket.on(EVENTS.CHAT_MESSAGE, ({ content }: { content: string }) => {
    const mapping = roomManager.getRoomBySocket(socket.id)
    if (!mapping) return

    const { roomId } = mapping
    const user = roomManager.getUserBySocket(socket.id)
    if (!user) return

    const message = {
      id: crypto.randomUUID(),
      userId: user.id,
      nickname: user.nickname,
      content,
      timestamp: Date.now(),
      type: 'user' as const,
    }

    roomManager.addChatMessage(roomId, message)
    io.to(roomId).emit(EVENTS.CHAT_MESSAGE, message)
  })
}
