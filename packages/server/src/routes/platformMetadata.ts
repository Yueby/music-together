import { Router, type Request, type RequestHandler, type Response, type Router as RouterType } from 'express'
import {
  MAPP_METADATA_MAX_BYTES,
  MAPP_METADATA_TARGETS,
  parseMappMetadataRequest,
  type MappMetadataRequest,
} from '@music-together/shared'
import {
  getArtistAlbumsMetadata,
  getArtistMetadata,
  getArtistSongsMetadata,
  getDailyMetadata,
  getHomeMetadata,
  getMusicLyricMetadata,
  getMusicTtmlMetadata,
  getMyPlaylistPageMetadata,
  getPlaylistPageMetadata,
  getRadarMetadata,
  PlaylistAccessError,
  searchMusicMetadata,
} from '../controllers/musicMetadataController.js'
import { CatalogError } from '../services/catalogUtils.js'
import { coverProxyRateLimit, musicApiRateLimit } from '../middleware/httpRateLimiter.js'
import { fetchPlatformCover, type CoverFailure, type CoverResult } from '../services/coverProxy.js'
import { withTimeout } from '../utils/withTimeout.js'
import { MAPP_PREFLIGHT_MAX_AGE, PREFLIGHT_HEADERS, setPlatformCorsHeaders, verifyPlatformCaller } from './platformAuth.js'
import type { PlatformIdentityInput } from './platformAuth.js'

export type MusicMetadataIdentityInput = PlatformIdentityInput
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
  artist?: typeof getArtistMetadata
  artistSongs?: typeof getArtistSongsMetadata
  artistAlbums?: typeof getArtistAlbumsMetadata
  playlist?: typeof getPlaylistPageMetadata
  myPlaylist?: typeof getMyPlaylistPageMetadata
  daily?: typeof getDailyMetadata
  home?: typeof getHomeMetadata
  radar?: typeof getRadarMetadata
  cover?: (url: string) => Promise<CoverResult>
}
type ParsedRequest = MappMetadataRequest
/** Handler for a JSON target: receives exactly the query type the shared schema produces for it. */
type JsonHandlers = {
  [K in Exclude<ParsedRequest['kind'], 'cover' | 'lyric'>]: (
    query: Extract<ParsedRequest, { kind: K }>['query'],
    /** The platform identity verified for this request, never anything from the query. */
    caller: { userId: string },
  ) => Promise<unknown>
}

const REQUEST_TIMEOUT_MS = 20_000

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
  // 502/504 from the origin are replaced by Cloudflare with a page that has no CORS headers, which the mini-app can
  // then only report as a CORS failure. Answer 503 on the wire; the fixed `code` carries the distinction.
  const wire = safe.status === 502 || safe.status === 504 ? 503 : safe.status
  res.status(wire).json({ code: safe.code })
}

/** Catalog failures (artist pages) as fixed codes; anything else keeps the generic failure. */
function catalogError(error: unknown): unknown {
  if (error instanceof PlaylistAccessError) {
    return new MetadataError(error.status, error.status === 401 ? 'METADATA_UNAUTHORIZED' : 'METADATA_FORBIDDEN')
  }
  if (!(error instanceof CatalogError)) return error
  switch (error.kind) {
    case 'unsupported':
      return new MetadataError(400, 'METADATA_UNSUPPORTED')
    case 'login-required':
      return new MetadataError(401, 'METADATA_LOGIN_REQUIRED')
    case 'not-found':
      return new MetadataError(404, 'METADATA_NOT_FOUND')
    case 'upstream':
      return new MetadataError(502, 'METADATA_FAILED')
  }
}

/** Fixed codes only; the upstream status and body never reach the platform client. */
function coverError(kind: CoverFailure): MetadataError {
  if (kind === 'host') return new MetadataError(403, 'METADATA_COVER_HOST_REJECTED')
  if (kind === 'invalid') return new MetadataError(502, 'METADATA_COVER_REJECTED')
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
  const artist = options.artist ?? getArtistMetadata
  const artistSongs = options.artistSongs ?? getArtistSongsMetadata
  const artistAlbums = options.artistAlbums ?? getArtistAlbumsMetadata
  const playlist = options.playlist ?? getPlaylistPageMetadata
  const myPlaylist = options.myPlaylist ?? getMyPlaylistPageMetadata
  const daily = options.daily ?? getDailyMetadata
  const home = options.home ?? getHomeMetadata
  const radar = options.radar ?? getRadarMetadata
  const cover = options.cover ?? ((url: string) => fetchPlatformCover(url))
  /** JSON targets without their own response headers. */
  const handlers: JsonHandlers = {
    search: (query) => search(query),
    ttml: async (query) => {
      const found = await ttml(query)
      if (!found.ok) throw new MetadataError(502, 'METADATA_FAILED')
      return { lines: found.lines }
    },
    artist: (query) => artist(query),
    artistSongs: (query) => artistSongs(query),
    artistAlbums: (query) => artistAlbums(query),
    // Anonymous on purpose: personal playlists need an account and never use this public target.
    playlist: (query) => playlist(query, null),
    // These two answers depend on who asks: the account is looked up from the verified identity.
    myPlaylist: async (query, caller) => myPlaylist(query, caller.userId),
    daily: async (query, caller) => daily(query, caller.userId),
    home: async (query, caller) => home(query, caller.userId),
    radar: (query) => radar(query),
  }
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
      setPlatformCorsHeaders(res, options.allowedOrigin)

      if (req.method === 'OPTIONS') {
        const names = preflightHeaders(req)
        if (
          req.headers['access-control-request-method'] !== 'GET' ||
          !names.includes('authorization') ||
          names.some((name) => !PREFLIGHT_HEADERS.includes(name))
        ) {
          throw new MetadataError(403, 'METADATA_PREFLIGHT_REJECTED')
        }
        res.setHeader('Access-Control-Max-Age', MAPP_PREFLIGHT_MAX_AGE)
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

      req.identityUserId = await verifyPlatformCaller(
        { url: raw, origin: requestOrigin, authorization: req.headers.authorization, method: req.method },
        (input) => options.verifyIdentity(input),
        new MetadataError(401, 'METADATA_UNAUTHORIZED'),
        'strict',
      )
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
  router.use(async (req, res) => {
    try {
      const parsed = res.locals.metadata as ParsedRequest
      if (parsed.kind === 'cover') {
        const work = Promise.resolve().then(() => cover(parsed.query.url))
        const result = await withTimeout(work, REQUEST_TIMEOUT_MS, new MetadataError(504, 'METADATA_TIMEOUT'))
        if (!result.ok) throw coverError(result.kind)
        res.setHeader('X-Content-Type-Options', 'nosniff')
        res.status(200).type(result.contentType).send(result.body)
        return
      }
      const timeout = new MetadataError(504, 'METADATA_TIMEOUT')
      const work = Promise.resolve()
        .then(async () => {
          if (parsed.kind === 'lyric') {
            const body = await lyric(parsed.query)
            return { body, cacheControl: body.cacheable ? 'private, max-age=1800' : 'no-store' }
          }
          const handler = handlers[parsed.kind] as (query: unknown, caller: { userId: string }) => Promise<unknown>
          const caller = { userId: req.identityUserId as string } // set from the verified token by the first middleware
          return { body: await handler(parsed.query, caller) }
        })
        .catch((error: unknown) => {
          throw catalogError(error)
        })
      const result = await withTimeout(work, REQUEST_TIMEOUT_MS, timeout)
      const json = JSON.stringify(result.body)
      if (Buffer.byteLength(json) > MAPP_METADATA_MAX_BYTES) throw new MetadataError(502, 'METADATA_RESPONSE_TOO_LARGE')
      if (result.cacheControl) {
        res.setHeader('Vary', 'Origin, Authorization')
        res.setHeader('Cache-Control', result.cacheControl)
      }
      res.status(200).type('json').send(json)
    } catch (error) {
      sendError(res, error)
    }
  })

  return router
}
