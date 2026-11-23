import { RateLimiterMemory } from 'rate-limiter-flexible'
import { EVENTS, ERROR_CODE, LIMITS } from '@music-together/shared'
import type { ErrorCode } from '@music-together/shared'
import type { TypedSocket } from './types.js'

const RATE_LIMIT_POINTS = 10
const RATE_LIMIT_DURATION_S = 5

/**
 * Per-identity rate limiter for critical socket events.
 * Shared across all controllers to prevent event spam.
 *
 * Separate limiter from chat (which has its own) — this covers
 * VOTE_START, QUEUE_ADD, PLAYER_PLAY, PLAYER_SEEK, etc.
 *
 * None of these limiters are cleaned up when a socket disconnects: the counters expire on their own, and deleting
 * them on disconnect would let a client reset its budget just by reconnecting.
 */
const socketEventLimiter = new RateLimiterMemory({
  points: RATE_LIMIT_POINTS,
  duration: RATE_LIMIT_DURATION_S,
})

const authEventLimiter = new RateLimiterMemory({
  points: 30,
  duration: 60,
})

/**
 * QR status polling has its own budget: the client polls every QR_TIMING.POLL_INTERVAL_MS (2 s = 30 per minute), and
 * a few tabs or a retry must not run into the limit mid-scan, nor spend the budget of the other account events.
 */
const authQrCheckLimiter = new RateLimiterMemory({
  points: 60,
  duration: 60,
})

/** Reading the room list: it serialises every room, so a script must not be able to ask for it in a loop. */
const roomListLimiter = new RateLimiterMemory({
  points: 20,
  duration: 10,
})

/** Entering a room (create / join): generous for rejoins and reconnects, tight enough to stop scripted scanning. */
const roomEntryLimiter = new RateLimiterMemory({
  points: 10,
  duration: 10,
})

/** Wrong room passwords per identity and room. Only failures consume a point, so a correct password costs nothing. */
const joinPasswordFailureLimiter = new RateLimiterMemory({
  points: LIMITS.ROOM_JOIN_PASSWORD_MAX_FAILURES,
  duration: 60,
})

function identityKey(socket: TypedSocket): string {
  return socket.data.identityUserId ?? socket.id
}

/**
 * Consume a rate limit point for the given socket's user.
 * Keyed by userId (not socket.id) to prevent bypass via multiple connections.
 * Returns true if allowed, false if rate-limited (error already emitted).
 */
async function consumeLimiter(
  socket: TypedSocket,
  limiter: RateLimiterMemory,
  keySuffix = '',
  code: ErrorCode = ERROR_CODE.RATE_LIMITED,
): Promise<boolean> {
  const key = `${identityKey(socket)}${keySuffix}`
  try {
    await limiter.consume(key)
    return true
  } catch {
    socket.emit(EVENTS.ROOM_ERROR, {
      code,
      message: '操作过于频繁，请稍后再试',
    })
    return false
  }
}

export function checkSocketRateLimit(socket: TypedSocket): Promise<boolean> {
  return consumeLimiter(socket, socketEventLimiter)
}

/** Separate auth budget so normal 2-second QR polling is not mixed with player controls. */
export function checkAuthRateLimit(socket: TypedSocket): Promise<boolean> {
  return consumeLimiter(socket, authEventLimiter, ':auth')
}

/** AUTH_CHECK_QR polling budget (see `authQrCheckLimiter`). */
export function checkAuthQrCheckRateLimit(socket: TypedSocket): Promise<boolean> {
  return consumeLimiter(socket, authQrCheckLimiter, ':auth-qr')
}

/**
 * ROOM_LIST budget, kept apart from player controls. A refused read is dropped without an error: the lobby simply
 * keeps the list it has, and a room-level error would be misread as the outcome of something else.
 */
export async function checkRoomListRateLimit(socket: TypedSocket): Promise<boolean> {
  try {
    await roomListLimiter.consume(`${identityKey(socket)}:room-list`)
    return true
  } catch {
    return false
  }
}

/** ROOM_CREATE / ROOM_JOIN budget, kept apart from player controls. */
export function checkRoomEntryRateLimit(socket: TypedSocket): Promise<boolean> {
  return consumeLimiter(socket, roomEntryLimiter, ':room-entry', ERROR_CODE.ROOM_ENTRY_LIMITED)
}

// ---------------------------------------------------------------------------
// Room password guessing
// ---------------------------------------------------------------------------

function joinFailureKey(socket: TypedSocket, roomId: string): string {
  return `${identityKey(socket)}:join-password:${roomId}`
}

/**
 * True once this identity has sent too many wrong passwords to this room within the last minute.
 * While locked, the caller must not let any password through (a correct guess would confirm the guess);
 * requests that need no password (rejoin ticket, already a member, creator, admin) are unaffected.
 */
export async function isJoinPasswordLocked(socket: TypedSocket, roomId: string): Promise<boolean> {
  const state = await joinPasswordFailureLimiter.get(joinFailureKey(socket, roomId))
  return state !== null && state.consumedPoints >= LIMITS.ROOM_JOIN_PASSWORD_MAX_FAILURES
}

/** Count one wrong password against this identity and room. */
export async function recordJoinPasswordFailure(socket: TypedSocket, roomId: string): Promise<void> {
  try {
    await joinPasswordFailureLimiter.consume(joinFailureKey(socket, roomId))
  } catch {
    // Already over the limit: the lock is in place, nothing more to count.
  }
}

/** A correct password clears the count: success is never punished. */
export async function clearJoinPasswordFailures(socket: TypedSocket, roomId: string): Promise<void> {
  await joinPasswordFailureLimiter.delete(joinFailureKey(socket, roomId))
}
