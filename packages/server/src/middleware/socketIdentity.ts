import { ServerResponse, type IncomingMessage } from 'node:http'
import type { TypedServer, TypedSocket } from './types.js'
import { getIdentityFromCookieHeader } from '../services/identityService.js'
import { logger } from '../utils/logger.js'
import { withTimeout } from '../utils/withTimeout.js'
import { ERROR_CODE, EVENTS } from '@music-together/shared'

const PLATFORM_AUTH_TIMEOUT_MS = 6_000

const PLATFORM_ROOM_EVENTS = new Set<string>([
  EVENTS.ROOM_CREATE,
  EVENTS.ROOM_JOIN,
  EVENTS.ROOM_LEAVE,
  EVENTS.ROOM_LIST,
  EVENTS.ROOM_SETTINGS,
  EVENTS.ROOM_SET_ROLE,
  EVENTS.PLAYER_PLAY,
  EVENTS.PLAYER_PAUSE,
  EVENTS.PLAYER_SEEK,
  EVENTS.PLAYER_NEXT,
  EVENTS.PLAYER_PREV,
  EVENTS.PLAYER_SYNC,
  EVENTS.PLAYER_SYNC_REQUEST,
  EVENTS.PLAYER_SET_MODE,
  EVENTS.QUEUE_ADD,
  EVENTS.QUEUE_ADD_BATCH,
  EVENTS.QUEUE_INSERT_AFTER_CURRENT,
  EVENTS.QUEUE_REMOVE,
  EVENTS.QUEUE_REORDER,
  EVENTS.QUEUE_CLEAR,
  EVENTS.CHAT_MESSAGE,
  EVENTS.VOTE_START,
  EVENTS.VOTE_CAST,
  EVENTS.NTP_PING,
  // Music-platform account events. They are safe on this channel because the controllers never trust the client for
  // identity: the account belongs to the server-verified platform user of this socket (`mapp_…`) and the room it
  // joined, exactly like a Web user's, and every one of them is rate limited per socket.
  EVENTS.AUTH_REQUEST_QR,
  EVENTS.AUTH_CHECK_QR,
  EVENTS.AUTH_SET_COOKIE,
  EVENTS.AUTH_LOGOUT,
  EVENTS.AUTH_GET_STATUS,
  EVENTS.PLAYLIST_GET_MY,
])

function restrictPlatformEvents(socket: TypedSocket): void {
  socket.use(([event], next) => {
    if (typeof event === 'string' && PLATFORM_ROOM_EVENTS.has(event)) {
      next()
      return
    }
    // Anything outside the reviewed list (including unknown events) is refused.
    socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.NO_PERMISSION, message: '此接入方式不支持该操作' })
  })
}

export interface SocketIdentityOptions {
  resolvePlatformIdentity?: (request: { url: string; origin: string | undefined }) => Promise<{ userId: string }>
}

/**
 * A platform handshake carries exactly one non-empty `mini_app_token`. Zero means a Web
 * handshake; empty or repeated tokens are invalid and must never fall back to the Cookie.
 */
function platformTokenState(rawUrl: string): 'absent' | 'invalid' | 'present' {
  const query = rawUrl.split('#')[0].split('?').slice(1).join('?')
  const tokens = new URLSearchParams(query).getAll('mini_app_token')
  if (tokens.length === 0) return 'absent'
  return tokens.length === 1 && tokens[0] ? 'present' : 'invalid'
}

/** The resolver verifies the platform token. Failures, timeouts and malformed IDs all yield undefined. */
async function verifyPlatformIdentity(
  resolver: NonNullable<SocketIdentityOptions['resolvePlatformIdentity']>,
  request: { url: string; origin: string | undefined },
): Promise<string | undefined> {
  try {
    const identity = await withTimeout(
      Promise.resolve().then(() => resolver(request)),
      PLATFORM_AUTH_TIMEOUT_MS,
      new Error('timeout'),
    )
    const userId: unknown = identity?.userId
    // Never log credentials or resolver errors.
    return typeof userId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(userId) ? userId : undefined
  } catch {
    return undefined
  }
}

/** Identities verified before the upgrade, keyed by the handshake request the socket later exposes. */
const verifiedPlatformRequests = new WeakMap<IncomingMessage, string>()

function rejectUnauthorized(req: IncomingMessage, res: ServerResponse): void {
  if (res instanceof ServerResponse) {
    res.statusCode = 401
    res.end()
    return
  }
  // Engine.IO's upgrade response is a stub whose end() only destroys the socket; send the 401 ourselves.
  req.socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
}

/**
 * Cookie auth is unchanged unless the handshake explicitly carries a platform token.
 * Platform tokens are verified by an Engine.IO middleware, i.e. before the WebSocket upgrade is accepted.
 */
export function attachSocketIdentity(io: TypedServer, options: SocketIdentityOptions = {}): void {
  const resolver = options.resolvePlatformIdentity
  const verifiedPlatformSockets = new WeakSet<TypedSocket>()
  if (resolver) {
    io.engine.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
      const url = req.url ?? ''
      const state = platformTokenState(url)
      if (state === 'absent') {
        next()
        return
      }
      const userId =
        state === 'present' ? await verifyPlatformIdentity(resolver, { url, origin: req.headers.origin }) : undefined
      if (!userId) {
        rejectUnauthorized(req, res)
        return
      }
      if (req.socket.destroyed) return
      verifiedPlatformRequests.set(req, userId)
      next()
    })
    io.on('connection', (socket: TypedSocket) => {
      if (!verifiedPlatformSockets.has(socket)) return
      verifiedPlatformSockets.delete(socket)
      socket.emit(EVENTS.IDENTITY_READY, { userId: socket.data.identityUserId })
    })
  }
  io.use((socket: TypedSocket, next: (err?: Error) => void) => {
    const rawUrl = socket.request?.url ?? socket.handshake.url
    if (platformTokenState(rawUrl) !== 'absent') {
      // A platform handshake must have been verified before the upgrade; never fall back to the Cookie.
      const userId = verifiedPlatformRequests.get(socket.request)
      if (!userId) {
        next(new Error('UNAUTHENTICATED'))
        return
      }
      socket.data.identityUserId = userId
      restrictPlatformEvents(socket)
      verifiedPlatformSockets.add(socket)
      next()
      return
    }
    const identity = getIdentityFromCookieHeader(socket.handshake.headers.cookie)
    if (!identity) {
      logger.warn('Socket identity verification failed', {
        socketId: socket.id,
        hasCookieHeader: Boolean(socket.handshake.headers.cookie),
        origin: socket.handshake.headers.origin ?? null,
      })
      next(new Error('UNAUTHENTICATED'))
      return
    }
    socket.data.identityUserId = identity.userId
    logger.info('Socket identity verified', {
      socketId: socket.id,
      userId: identity.userId,
    })
    next()
  })
}
