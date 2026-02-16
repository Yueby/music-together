import { RateLimiterMemory } from 'rate-limiter-flexible'
import { EVENTS, ERROR_CODE } from '@music-together/shared'
import type { TypedSocket } from './types.js'

/**
 * Per-socket rate limiter for critical socket events.
 * Shared across all controllers to prevent event spam.
 *
 * Separate limiter from chat (which has its own) — this covers
 * VOTE_START, QUEUE_ADD, PLAYER_PLAY, PLAYER_SEEK, etc.
 */
const socketEventLimiter = new RateLimiterMemory({
  points: 10,   // 10 events
  duration: 5,  // per 5 seconds
})

/**
 * Consume a rate limit point for the given socket.
 * Returns true if allowed, false if rate-limited (error already emitted).
 */
export async function checkSocketRateLimit(socket: TypedSocket): Promise<boolean> {
  try {
    await socketEventLimiter.consume(socket.id)
    return true
  } catch {
    socket.emit(EVENTS.ROOM_ERROR, {
      code: ERROR_CODE.RATE_LIMITED,
      message: '操作过于频繁，请稍后再试',
    })
    return false
  }
}
