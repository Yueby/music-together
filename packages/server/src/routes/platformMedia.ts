import { Router, type RequestHandler, type Response, type Router as RouterType } from 'express'
import { mappRoomMediaQuerySchema } from '@music-together/shared'
import { createPlatformMediaService } from '../services/platformMediaService.js'
import { MediaError } from '../services/mediaSourceRequest.js'
import { mediaStreamRateLimit } from '../middleware/httpRateLimiter.js'
import { withTimeout } from '../utils/withTimeout.js'

export interface RoomMediaIdentityInput {
  url: string
  origin: string | undefined
  authorization: string | undefined
  method: string
}
interface Options {
  allowedOrigin: string
  verifyIdentity: (input: RoomMediaIdentityInput) => Promise<{ userId: string }>
  /** Defaults to the shared per-identity media limiter. */
  rateLimit?: RequestHandler
  service?: ReturnType<typeof createPlatformMediaService>
}

const PATH = '/api/mapp/audio'
const AUTH_TIMEOUT_MS = 6_000
const PLATFORM_USER_ID = /^mapp_[a-f0-9]{32}$/
const PREFLIGHT_HEADERS = ['authorization', 'content-type']

/** Error bodies carry only a fixed code; never upstream, provider or resolver details. */
function sendError(res: Response, error: unknown): void {
  if (res.destroyed || res.writableFinished) return
  if (res.headersSent) {
    res.destroy()
    return
  }
  const safe = error instanceof MediaError ? error : new MediaError('MEDIA_FAILED', 502)
  // A failure after header preparation must not advertise the upstream length/type.
  for (const name of ['Content-Length', 'Content-Type', 'Content-Encoding']) res.removeHeader(name)
  res.setHeader('Cache-Control', 'no-store')
  res.status(safe.status).json({ code: safe.code })
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
      next()
    } catch (error) {
      sendError(res, error)
    }
  })

  // 2. Per-identity rate limit.
  router.use(PATH, options.rateLimit ?? mediaStreamRateLimit)

  // 3. Stream. Client disconnects cancel the upstream request; the service enforces the 30s limit.
  router.use(PATH, async (req, res) => {
    const controller = new AbortController()
    res.once('close', () => {
      if (!res.writableFinished) controller.abort()
    })
    try {
      await service.stream({ ...res.locals.mediaQuery, userId: req.identityUserId! }, res, controller.signal)
    } catch (error) {
      sendError(res, error)
    }
  })

  return router
}
