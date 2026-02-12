import { EVENTS, LIMITS } from '@music-together/shared'
import * as chatService from '../services/chatService.js'
import { createWithRoom } from '../middleware/withRoom.js'
import type { TypedServer, TypedSocket } from '../middleware/types.js'

export function registerChatController(io: TypedServer, socket: TypedSocket) {
  const withRoom = createWithRoom(io)

  socket.on(
    EVENTS.CHAT_MESSAGE,
    withRoom((ctx, { content }) => {
      if (!content || typeof content !== 'string') return
      const trimmed = content.trim()
      if (trimmed.length === 0 || trimmed.length > LIMITS.CHAT_CONTENT_MAX_LENGTH) return

      const message = chatService.createMessage(ctx.roomId, ctx.user, trimmed)
      io.to(ctx.roomId).emit(EVENTS.CHAT_MESSAGE, message)
    }),
  )
}
