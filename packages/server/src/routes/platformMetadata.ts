import { Router, type Request, type RequestHandler, type Response, type Router as RouterType } from 'express'
import { MAPP_METADATA_MAX_BYTES, MAPP_METADATA_TARGETS, parseMappMetadataRequest } from '@music-together/shared'
import {
  getMusicLyricMetadata,
  getMusicTtmlMetadata,
  searchMusicMetadata,
} from '../controllers/musicMetadataController.js'
import { coverProxyRateLimit, musicApiRateLimit } from '../middleware/httpRateLimiter.js'
import { fetchPlatformCover, type CoverResult } from '../services/coverProxy.js'
import { withTimeout } from '../utils/withTimeout.js'

export interface MusicMetadataIdentityInput {
  url: string
  origin: string | undefined
  authorization: string | undefined
  method: string
}
interface Options {
  allowedOrigin: string
  verifyIdentity: (input: MusicMetadataIdentityInput) => Promise<{ userId: string }>
  /** Search/lyric limiter; defaults to the shared per-identity music API limiter. */
  rateLimit?: RequestHandler
  /** Cover limiter; defaults to the same quota the Web cover proxy uses. */
  coverRateLimit?: RequestHandler
  search?: typeof searchMusicMetadata
  lyric?: typeof getMusicLyricMetadata
  ttml?: typeof getMusicTtmlMetadata
  cover?: (url: string) => Promise<CoverResult>
}
type ParsedRequest = ReturnType<typeof parseMappMetadataRequest>

const AUTH_TIMEOUT_MS = 6_000
const REQUEST_TIMEOUT_MS = 20_000
const BEARER_TOKEN = /^Bearer [A-Za-z0-9_.-]+$/
const PLATFORM_USER_ID = /^mapp_[a-f0-9]{32}$/
const PREFLIGHT_HEADERS = ['authorization', 'content-type']

class MetadataError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code)
  }
}

function preflightHeaders(req: Request): string[] {
  const value = req.headers['access-control-request-headers']
  return typeof value === 'string' ? value.split(',').map((name) => name.trim().toLowerCase()) : []
}

/**
 * Only requests that explicitly identify as platform requests are handled here.
 * Normal Web (Cookie) requests fall through to the original chain untouched.
 */
function isPlatformRequest(req: Request): boolean {
  if (req.headers.authorization !== undefined) return true
  if (req.method === 'OPTIONS') return preflightHeaders(req).includes('authorization')
  return new URL(req.originalUrl, 'http://localhost').searchParams.has('mini_app_token')
}

/** Error bodies carry only a fixed code; never provider or resolver details. */
function sendError(res: Response, error: unknown): void {
  if (res.headersSent) {
    res.destroy()
    return
  }
  const safe = error instanceof MetadataError ? error : new MetadataError(502, 'METADATA_FAILED')
  res.status(safe.status).json({ code: safe.code })
}

/** Fixed codes only; the upstream status and body never reach the platform client. */
function coverError(status: number): MetadataError {
  if (status === 403) return new MetadataError(403, 'METADATA_COVER_HOST_REJECTED')
  if (status === 413) return new MetadataError(502, 'METADATA_COVER_REJECTED')
  return new MetadataError(502, 'METADATA_COVER_FAILED')
}

const TARGET_PATHS = new Set<string>(Object.values(MAPP_METADATA_TARGETS).map((target) => target.path))

/**
 * Unmounted by default. Handles only the exact external metadata paths (search, lyric, TTML, cover).
 * Mount it before the generic music API rate limiter: it applies the same
 * limiter itself, keyed by the verified platform identity.
 */
export function createPlatformMetadataRouter(options: Options): RouterType {
  const origin = new URL(options.allowedOrigin)
  if (origin.protocol !== 'https:' || origin.origin !== options.allowedOrigin || origin.username || origin.password) {
    throw new Error('METADATA_CONFIGURATION_REJECTED')
  }
  const search = options.search ?? searchMusicMetadata
  const lyric = options.lyric ?? getMusicLyricMetadata
  const ttml = options.ttml ?? getMusicTtmlMetadata
  const cover = options.cover ?? ((url: string) => fetchPlatformCover(url))
  const searchLimit = options.rateLimit ?? musicApiRateLimit
  const coverLimit = options.coverRateLimit ?? coverProxyRateLimit
  const router = Router()

  // 1. Select platform requests and verify origin, method, query and identity. No Cookie fallback.
  router.use(async (req, res, next) => {
    const raw = req.originalUrl
    const path = raw.split('?')[0]
    if (!TARGET_PATHS.has(path) || !isPlatformRequest(req)) {
      next('router')
      return
    }
    res.setHeader('Cache-Control', 'private, no-store, no-transform')
    try {
      const requestOrigin = req.headers.origin
      if (requestOrigin !== options.allowedOrigin) throw new MetadataError(403, 'METADATA_ORIGIN_REJECTED')
      res.setHeader('Access-Control-Allow-Origin', options.allowedOrigin)
      res.setHeader('Vary', 'Origin')
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')

      if (req.method === 'OPTIONS') {
        const names = preflightHeaders(req)
        if (
          req.headers['access-control-request-method'] !== 'GET' ||
          !names.includes('authorization') ||
          names.some((name) => !PREFLIGHT_HEADERS.includes(name))
        ) {
          throw new MetadataError(403, 'METADATA_PREFLIGHT_REJECTED')
        }
        res.status(204).end()
        return
      }
      if (req.method !== 'GET') throw new MetadataError(405, 'METADATA_METHOD_REJECTED')

      let parsed: ParsedRequest
      try {
        parsed = parseMappMetadataRequest(raw)
      } catch {
        throw new MetadataError(400, 'METADATA_QUERY_REJECTED')
      }

      const authorization = req.headers.authorization
      if (!authorization || authorization.length > 8199 || !BEARER_TOKEN.test(authorization)) {
        throw new MetadataError(401, 'METADATA_UNAUTHORIZED')
      }
      const unauthorized = new MetadataError(401, 'METADATA_UNAUTHORIZED')
      const identity = await withTimeout(
        Promise.resolve().then(() =>
          options.verifyIdentity({ url: raw, origin: requestOrigin, authorization, method: req.method }),
        ),
        AUTH_TIMEOUT_MS,
        unauthorized,
      ).catch(() => {
        throw unauthorized
      })
      if (!PLATFORM_USER_ID.test(identity?.userId)) throw unauthorized

      req.identityUserId = identity.userId
      res.locals.metadata = parsed
      next()
    } catch (error) {
      sendError(res, error)
    }
  })

  // 2. Per-identity rate limit (shared with the Web music API; covers use the Web cover quota).
  router.use((req, res, next) =>
    ((res.locals.metadata as ParsedRequest).kind === 'cover' ? coverLimit : searchLimit)(req, res, next),
  )

  // 3. Reuse the shared metadata controllers; covers answer with image bytes instead of JSON.
  router.use(async (_req, res) => {
    try {
      const parsed = res.locals.metadata as ParsedRequest
      if (parsed.kind === 'cover') {
        const work = Promise.resolve().then(() => cover(parsed.query.url))
        const result = await withTimeout(work, REQUEST_TIMEOUT_MS, new MetadataError(504, 'METADATA_TIMEOUT'))
        if (!result.ok) throw coverError(result.status)
        res.setHeader('X-Content-Type-Options', 'nosniff')
        res.status(200).type(result.contentType).send(result.body)
        return
      }
      const work = Promise.resolve().then<unknown>(async () => {
        if (parsed.kind === 'search') return search(parsed.query)
        if (parsed.kind === 'lyric') return lyric(parsed.query)
        const found = await ttml(parsed.query)
        if (!found.ok) throw new MetadataError(502, 'METADATA_FAILED')
        return { lines: found.lines }
      })
      const json = JSON.stringify(
        await withTimeout(work, REQUEST_TIMEOUT_MS, new MetadataError(504, 'METADATA_TIMEOUT')),
      )
      if (Buffer.byteLength(json) > MAPP_METADATA_MAX_BYTES) throw new MetadataError(502, 'METADATA_RESPONSE_TOO_LARGE')
      res.status(200).type('json').send(json)
    } catch (error) {
      sendError(res, error)
    }
  })

  return router
}
