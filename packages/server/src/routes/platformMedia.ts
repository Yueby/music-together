import { createHash, timingSafeEqual } from 'node:crypto'
import { Router, type RequestHandler, type Response, type Router as RouterType } from 'express'
import { MUSIC_SOURCES, mappRoomMediaQuerySchema, type MusicSource } from '@music-together/shared'
import {
  createPlatformMediaService,
  recordEdgeRelayBypass,
  recordEdgeRelayFallback,
  recordEdgeRelayResolve,
} from '../services/platformMediaService.js'
import { MediaError } from '../services/mediaSourceRequest.js'
import { mediaStreamRateLimit } from '../middleware/httpRateLimiter.js'
import { logger } from '../utils/logger.js'
import { withTimeout } from '../utils/withTimeout.js'

export interface RoomMediaIdentityInput {
  url: string
  origin: string | undefined
  authorization: string | undefined
  method: string
}
type PlatformMediaService = ReturnType<typeof createPlatformMediaService>
interface Options {
  allowedOrigin: string
  verifyIdentity: (input: RoomMediaIdentityInput) => Promise<{ userId: string }>
  /** Defaults to the shared per-identity media limiter. */
  rateLimit?: RequestHandler
  service?: Pick<PlatformMediaService, 'stream'> & Partial<Pick<PlatformMediaService, 'resolve'>>
  /** Optional shared secret for trusted edge relay (`X-MT-Relay-Secret`). Unset = direct streaming only. */
  relaySecret?: string
  /** Sources permitted to use edge relay resolution; excluded sources silently fall back to direct streaming. */
  relaySources?: readonly MusicSource[]
}

const PATH = '/api/mapp/audio'
const AUTH_TIMEOUT_MS = 6_000
const PLATFORM_USER_ID = /^mapp_[a-f0-9]{32}$/
const PREFLIGHT_HEADERS = ['authorization', 'content-type']
const RELAY_MODE_RESOLVE = 'resolve-v1'
const RELAY_MODE_FALLBACK = 'fallback-v1'

type RelayMode = 'direct' | typeof RELAY_MODE_RESOLVE | typeof RELAY_MODE_FALLBACK

function verifyRelaySecret(provided: string | undefined, expected: string | undefined): boolean {
  if (!provided || !expected) return false
  const providedDigest = createHash('sha256').update(provided, 'utf8').digest()
  const expectedDigest = createHash('sha256').update(expected, 'utf8').digest()
  return timingSafeEqual(providedDigest, expectedDigest)
}

/** Error bodies carry only a fixed code; never upstream, provider or resolver details. */
function sendError(res: Response, error: unknown): void {
  if (res.destroyed || res.writableFinished) return
  if (res.headersSent) {
    res.destroy()
    return
  }
  const safe = error instanceof MediaError ? error : new MediaError('MEDIA_FAILED', 502)
  // Fixed codes only (no URL, cookie or provider text): enough to tell which stage failed. Auth rejections and
  // client cancellations are routine and stay quiet.
  if (safe.status !== 401 && safe.status !== 499) logger.warn('Platform audio request failed', { code: safe.code, status: safe.status })
  // A failure after header preparation must not advertise the upstream length/type.
  for (const name of ['Content-Length', 'Content-Type', 'Content-Encoding', 'X-MT-Relay-Mode']) res.removeHeader(name)
  res.setHeader('Cache-Control', 'no-store')
  // Cloudflare replaces an origin 502/504 with its own error page, which carries no CORS headers: the browser then
  // reports a bare CORS failure and the fixed code below never arrives. 503 is passed through untouched.
  res.status(safe.status === 502 || safe.status === 504 ? 503 : safe.status).json({ code: safe.code })
}

/**
 * Unmounted opt-in roomAudio/platform router; the Web/Cookie startup path is untouched.
 * Mount it before the generic `/api` Cookie bootstrap: it never falls back to a Cookie identity.
 */
export function createPlatformMediaRouter(options: Options): RouterType {
  const parsedOrigin = new URL(options.allowedOrigin)
  if (
    parsedOrigin.protocol !== 'https:' ||
    parsedOrigin.origin !== options.allowedOrigin ||
    parsedOrigin.username ||
    parsedOrigin.password
  ) {
    throw new Error('MEDIA_CONFIGURATION_REJECTED')
  }
  const service = options.service ?? createPlatformMediaService()
  const allowedRelaySources = new Set<MusicSource>(options.relaySources ?? MUSIC_SOURCES)
  const limiter = options.rateLimit ?? mediaStreamRateLimit
  const router = Router()

  // 1. Origin, method, query and identity. No Cookie fallback.
  router.use(PATH, async (req, res, next) => {
    const origin = req.get('Origin')
    try {
      if (origin !== options.allowedOrigin) throw new MediaError('MEDIA_ORIGIN_REJECTED', 403)
      res.setHeader('Access-Control-Allow-Origin', options.allowedOrigin)
      res.setHeader('Vary', 'Origin')
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type, Content-Encoding')

      // originalUrl survives mounting prefixes; never rebuild it from req.url/Host/forwarded headers.
      const raw = req.originalUrl
      if (raw.split('?')[0] !== PATH) throw new MediaError('MEDIA_PATH_REJECTED', 404)
      if (req.method === 'OPTIONS') {
        const requestedMethod = req.get('Access-Control-Request-Method')
        const requestedHeaders = req.get('Access-Control-Request-Headers')
        if (
          (requestedMethod && requestedMethod !== 'GET') ||
          requestedHeaders?.split(',').some((name) => !PREFLIGHT_HEADERS.includes(name.trim().toLowerCase()))
        ) {
          throw new MediaError('MEDIA_PREFLIGHT_REJECTED', 403)
        }
        res.status(204).end()
        return
      }
      if (req.method !== 'GET') throw new MediaError('MEDIA_METHOD_REJECTED', 405)

      const entries = [...new URL(raw, options.allowedOrigin).searchParams]
      const query = mappRoomMediaQuerySchema.safeParse(Object.fromEntries(entries))
      // fromEntries collapses repeated keys, so reject duplicates explicitly.
      if (!query.success || new Set(entries.map(([key]) => key)).size !== entries.length) {
        throw new MediaError('MEDIA_QUERY_REJECTED', 400)
      }

      const authorization = req.get('Authorization')
      if (!authorization?.startsWith('Bearer ') || authorization.length > 8199) {
        throw new MediaError('MEDIA_UNAUTHORIZED', 401)
      }
      const unauthorized = new MediaError('MEDIA_UNAUTHORIZED', 401)
      const identity = await withTimeout(
        Promise.resolve().then(() => options.verifyIdentity({ url: raw, origin, authorization, method: req.method })),
        AUTH_TIMEOUT_MS,
        unauthorized,
      ).catch(() => {
        throw unauthorized
      })
      if (!PLATFORM_USER_ID.test(identity?.userId)) throw unauthorized

      req.identityUserId = identity.userId
      res.locals.mediaQuery = query.data
      const relayHeader = req.get('X-MT-Relay')
      const secretValid = verifyRelaySecret(req.get('X-MT-Relay-Secret'), options.relaySecret)
      let relayMode: RelayMode = 'direct'
      if (secretValid && relayHeader === RELAY_MODE_RESOLVE) relayMode = RELAY_MODE_RESOLVE
      else if (secretValid && relayHeader === RELAY_MODE_FALLBACK) relayMode = RELAY_MODE_FALLBACK
      res.locals.relayMode = relayMode
      next()
    } catch (error) {
      sendError(res, error)
    }
  })

  // 2. Per-identity rate limit (trusted `fallback-v1` skips second deduction because `resolve-v1` already counted).
  router.use(PATH, (req, res, next) => {
    if (res.locals.relayMode === RELAY_MODE_FALLBACK) {
      next()
      return
    }
    limiter(req, res, next)
  })

  // 3. Resolve for edge relay or stream directly. Client disconnects cancel upstream work.
  router.use(PATH, async (req, res) => {
    const controller = new AbortController()
    res.once('close', () => {
      if (!res.writableFinished) controller.abort()
    })
    try {
      const relayMode = (res.locals.relayMode ?? 'direct') as RelayMode
      const mediaInput = { ...res.locals.mediaQuery, userId: req.identityUserId! }
      if (relayMode === RELAY_MODE_RESOLVE && service.resolve && allowedRelaySources.size > 0) {
        const resolved = await service.resolve(mediaInput, controller.signal)
        if (allowedRelaySources.has(resolved.source)) {
          recordEdgeRelayResolve()
          res.setHeader('X-MT-Relay-Mode', RELAY_MODE_RESOLVE)
          res.setHeader('Cache-Control', 'private, no-store, no-transform')
          res.status(200).json(resolved)
          return
        }
      } else if (relayMode === RELAY_MODE_FALLBACK) {
        recordEdgeRelayFallback()
        logger.warn('relay_fallback', {
          event: 'relay_fallback',
          roomId: mediaInput.roomId,
          trackId: mediaInput.trackId,
          userId: mediaInput.userId,
        })
      }
      if (options.relaySecret && allowedRelaySources.size > 0 && relayMode === 'direct') {
        recordEdgeRelayBypass()
      }
      await service.stream(mediaInput, res, controller.signal)
    } catch (error) {
      sendError(res, error)
    }
  })

  return router
}
