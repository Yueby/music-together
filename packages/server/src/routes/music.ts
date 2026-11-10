import {
  searchQuerySchema,
  urlQuerySchema,
  lyricQuerySchema,
  ttmlQuerySchema,
  coverQuerySchema,
  playlistQuerySchema,
} from '@music-together/shared'
import { Router, type Router as RouterType, type Request, type Response } from 'express'
import type { ZodSchema } from 'zod'
import { musicProvider } from '../services/musicProvider.js'
import { fetchCoverImage } from '../services/coverProxy.js'
import * as authService from '../services/authService.js'
import { roomRepo } from '../repositories/roomRepository.js'
import { logger } from '../utils/logger.js'
import { coverProxyRateLimit } from '../middleware/httpRateLimiter.js'
import { getMusicLyricMetadata, getMusicTtmlMetadata, searchMusicMetadata } from '../controllers/musicMetadataController.js'

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
  '/search',
  validated(searchQuerySchema, 'Search', async (data, _req, res) => {
    res.json(await searchMusicMetadata(data))
  }),
)

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
    const { source, id, limit, offset, total, roomId, type } = data

    let cookie: string | null = null
    if (roomId) {
      const identityUserId = _req.identityUserId
      if (!identityUserId) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }
      const room = roomRepo.get(roomId)
      if (!room || !room.users.some((u) => u.id === identityUserId)) {
        res.status(403).json({ error: 'Forbidden' })
        return
      }
      cookie = authService.getUserCookie(identityUserId, source, roomId)
    }

    const result = await musicProvider.getPlaylistPage(source, id, limit, offset, total, cookie, type)
    res.json({ tracks: result.tracks, total: result.total, offset, hasMore: result.hasMore })
  }),
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
