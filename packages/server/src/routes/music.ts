import {
  searchQuerySchema,
  urlQuerySchema,
  lyricQuerySchema,
  ttmlQuerySchema,
  coverQuerySchema,
  playlistQuerySchema,
  myPlaylistQuerySchema,
  artistQuerySchema,
  artistPageQuerySchema,
  discoverQuerySchema,
  dailyQuerySchema,
  homeQuerySchema,
} from '@music-together/shared'
import { Router, type Router as RouterType, type Request, type Response } from 'express'
import type { ZodSchema } from 'zod'
import { musicProvider } from '../services/musicProvider.js'
import { fetchCoverImage } from '../services/coverProxy.js'
import { logger } from '../utils/logger.js'
import { coverProxyRateLimit } from '../middleware/httpRateLimiter.js'
import { CatalogError } from '../services/catalogUtils.js'
import {
  getArtistAlbumsMetadata,
  getArtistMetadata,
  getArtistSongsMetadata,
  getDailyMetadata,
  getHomeMetadata,
  getRadarMetadata,
  getMusicLyricMetadata,
  getMusicTtmlMetadata,
  getMyPlaylistPageMetadata,
  getPlaylistPageMetadata,
  PlaylistAccessError,
  searchMusicMetadata,
} from '../controllers/musicMetadataController.js'

const router: RouterType = Router()

/**
 * Wrap an async route handler with validation + error handling.
 * Eliminates repeated try/catch + Zod boilerplate in each route.
 */
function validated<T>(
  schema: ZodSchema<T>,
  label: string,
  handler: (data: T, req: Request, res: Response) => Promise<void>,
) {
  return async (req: Request, res: Response) => {
    try {
      const parsed = schema.safeParse(req.query)
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid query parameters' })
        return
      }
      await handler(parsed.data, req, res)
    } catch (err) {
      logger.error(`${label} failed`, err)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
}

router.get(
  '/url',
  validated(urlQuerySchema, 'Get stream URL', async (data, _req, res) => {
    const { source, urlId, bitrate } = data
    const url = await musicProvider.getStreamUrl(source, urlId, bitrate)
    res.json({ url })
  }),
)

router.get(
  '/lyric',
  validated(lyricQuerySchema, 'Get lyric', async (data, _req, res) => {
    res.json(await getMusicLyricMetadata(data))
  }),
)

router.get(
  '/ttml',
  validated(ttmlQuerySchema, 'Get TTML', async (data, _req, res) => {
    const result = await getMusicTtmlMetadata(data)
    if (!result.ok) {
      res.status(502).json({ error: 'TTML unavailable' })
      return
    }
    // A song without a library entry is a normal answer (`lines: null`), not an error the browser would log.
    res.setHeader('Cache-Control', `private, max-age=${result.lines ? 3600 : 600}`)
    res.json({ lines: result.lines })
  }),
)

/** Cache policies of the catalog endpoints. Whatever depends on the caller's account is never shared or cached. */
const PUBLIC_CACHE = (seconds: number) => `private, max-age=${seconds}`
const ACCOUNT_CACHE = 'private, no-store'

/**
 * Catalog endpoints (artists, discovery, own playlists) answer with a sanitized status and a fixed error code instead of
 * the generic 500. The cache header is only set on success, so a failure is never cached.
 */
function catalogRoute<T>(
  schema: ZodSchema<T>,
  label: string,
  cacheControl: string | null,
  load: (data: T, userId: string | undefined) => Promise<unknown>,
) {
  return validated(schema, label, async (data, req, res) => {
    try {
      const body = await load(data, req.identityUserId)
      if (cacheControl) res.setHeader('Cache-Control', cacheControl)
      res.json(body)
    } catch (error) {
      res.setHeader('Cache-Control', 'no-store')
      if (error instanceof PlaylistAccessError) {
        res.status(error.status).json({ error: error.status === 401 ? 'Unauthorized' : 'Forbidden' })
        return
      }
      if (!(error instanceof CatalogError)) throw error
      res.status(error.status).json({ error: error.code })
    }
  })
}

// No cache policy of its own (as before); a search that could not run answers 503 `SEARCH_UPSTREAM`, not an empty list.
router.get('/search', catalogRoute(searchQuerySchema, 'Search', null, (data) => searchMusicMetadata(data)))
router.get('/artist', catalogRoute(artistQuerySchema, 'Get artist', PUBLIC_CACHE(300), getArtistMetadata))
router.get(
  '/artist/songs',
  catalogRoute(artistPageQuerySchema, 'Get artist songs', PUBLIC_CACHE(300), getArtistSongsMetadata),
)
router.get(
  '/artist/albums',
  catalogRoute(artistPageQuerySchema, 'Get artist albums', PUBLIC_CACHE(300), getArtistAlbumsMetadata),
)
router.get(
  '/discover/radar',
  catalogRoute(discoverQuerySchema, 'Get radar playlists', PUBLIC_CACHE(600), getRadarMetadata),
)
router.get('/discover/daily', catalogRoute(dailyQuerySchema, 'Get daily songs', ACCOUNT_CACHE, getDailyMetadata))
router.get('/discover/home', catalogRoute(homeQuerySchema, 'Get discover home', ACCOUNT_CACHE, getHomeMetadata))

router.get(
  '/cover',
  validated(coverQuerySchema, 'Get cover', async (data, _req, res) => {
    const { source, picId, size } = data
    const url = await musicProvider.getCover(source, picId, size)
    res.json({ url })
  }),
)

router.get(
  '/playlist',
  validated(playlistQuerySchema, 'Get playlist', async (data, _req, res) => {
    // Public lists only: this route never selects a music account.
    res.json(await getPlaylistPageMetadata(data, null))
  }),
)

// Private tracks must not be shared or cached beyond the caller.
router.get(
  '/playlist/mine',
  catalogRoute(myPlaylistQuerySchema, 'Get own playlist', ACCOUNT_CACHE, getMyPlaylistPageMetadata),
)

// ---------------------------------------------------------------------------
// 封面图片代理 — 解决外部 CDN（如 QQ 音乐 y.gtimg.cn）的 CORS 限制
// AMLL 的 BackgroundRender 用 WebGL 纹理加载图片，需要同源或 CORS 允许
// ---------------------------------------------------------------------------
router.get('/cover-proxy', coverProxyRateLimit, async (req: Request, res: Response) => {
  const imageUrl = req.query.url as string | undefined
  if (!imageUrl) {
    res.status(400).json({ error: 'Missing url parameter' })
    return
  }

  try {
    const cover = await fetchCoverImage(imageUrl)
    if (!cover.ok) {
      res.status(cover.status).json({ error: cover.error })
      return
    }

    // 透传 content-type，设置缓存（封面图不会频繁变化）
    res.setHeader('Content-Type', cover.contentType)
    res.setHeader('Content-Length', String(cover.body.length))
    res.setHeader('Cache-Control', 'public, max-age=86400') // 24h 缓存
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(200).end(cover.body)
  } catch (err) {
    logger.error('Cover proxy failed', err, { imageUrl })
    if (!res.headersSent) {
      res.status(504).json({ error: 'Cover proxy failed' })
    } else {
      res.end()
    }
  }
})

export default router
