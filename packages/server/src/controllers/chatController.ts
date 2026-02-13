import { EVENTS, LIMITS, ERROR_CODE, chatMessageSchema } from '@music-together/shared'
import { RateLimiterMemory } from 'rate-limiter-flexible'
import * as chatService from '../services/chatService.js'
import { createWithRoom } from '../middleware/withRoom.js'
import type { TypedServer, TypedSocket } from '../middleware/types.js'

const chatLimiter = new RateLimiterMemory({
  points: LIMITS.CHAT_RATE_LIMIT_PER_SECOND,
  duration: 1, // 1 second
})

export function registerChatController(io: TypedServer, socket: TypedSocket) {
  const withRoom = createWithRoom(io)

  socket.on(
    EVENTS.CHAT_MESSAGE,
    withRoom(async (ctx, raw) => {
      // Rate limit check
      try {
        await chatLimiter.consume(ctx.socket.id)
      } catch {
        ctx.socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.RATE_LIMITED, message: '发送过于频繁，请稍后再试' })
        return
      }

      const parsed = chatMessageSchema.safeParse(raw)
      if (!parsed.success) {
        ctx.socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.INVALID_INPUT, message: '消息格式无效' })
        return
      }

      const trimmed = parsed.data.content.trim()
      if (trimmed.length === 0) return

      const message = chatService.createMessage(ctx.roomId, ctx.user, trimmed)
      io.to(ctx.roomId).emit(EVENTS.CHAT_MESSAGE, message)
    }),
  )
}
