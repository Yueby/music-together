import { RateLimiterMemory } from 'rate-limiter-flexible'
import { EVENTS, ERROR_CODE } from '@music-together/shared'
import type { TypedSocket } from './types.js'

const RATE_LIMIT_POINTS = 10
const RATE_LIMIT_DURATION_S = 5

/**
 * Per-socket rate limiter for critical socket events.
 * Shared across all controllers to prevent event spam.
 *
 * Separate limiter from chat (which has its own) — this covers
 * VOTE_START, QUEUE_ADD, PLAYER_PLAY, PLAYER_SEEK, etc.
 */
const socketEventLimiter = new RateLimiterMemory({
  points: RATE_LIMIT_POINTS,
  duration: RATE_LIMIT_DURATION_S,
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

/**
 * Clean up rate limiter entries for a disconnected socket.
 * Call this in the disconnect handler to prevent memory growth.
 */
export function cleanupSocketRateLimit(socketId: string): void {
  socketEventLimiter.delete(socketId).catch(() => {
    // Ignore — key may not exist if the socket never triggered a rate-limited event
  })
}
