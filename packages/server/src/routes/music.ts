import {
  searchQuerySchema,
  urlQuerySchema,
  lyricQuerySchema,
  coverQuerySchema,
  playlistQuerySchema,
} from '@music-together/shared'
import { Router, type Router as RouterType, type Request, type Response } from 'express'
import type { ZodSchema } from 'zod'
import { musicProvider } from '../services/musicProvider.js'
import * as authService from '../services/authService.js'
import { logger } from '../utils/logger.js'

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
    const { source, keyword, limit: pageSize, page: pageNum } = data
    const tracks = await musicProvider.search(source, keyword, pageSize, pageNum)
    res.json({ tracks, page: pageNum, hasMore: tracks.length >= pageSize })
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
    const { source, lyricId } = data
    const result = await musicProvider.getLyric(source, lyricId)
    res.json(result)
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
    const { source, id, limit, offset, total, roomId, userId } = data
    const cookie = roomId && userId ? authService.getUserCookie(userId, source, roomId) : null
    const result = await musicProvider.getPlaylistPage(source, id, limit, offset, total, cookie)
    res.json({ tracks: result.tracks, total: result.total, offset, hasMore: result.hasMore })
  }),
)

// ---------------------------------------------------------------------------
// 封面图片代理 — 解决外部 CDN（如 QQ 音乐 y.gtimg.cn）的 CORS 限制
// AMLL 的 BackgroundRender 用 WebGL 纹理加载图片，需要同源或 CORS 允许
// ---------------------------------------------------------------------------
const ALLOWED_COVER_HOSTS = [
  'y.gtimg.cn',
  'p1.music.126.net',
  'p2.music.126.net',
  'p3.music.126.net',
  'p4.music.126.net',
  'imgessl.kugou.com',
]

router.get('/cover-proxy', async (req: Request, res: Response) => {
  const imageUrl = req.query.url as string | undefined
  if (!imageUrl) {
    res.status(400).json({ error: 'Missing url parameter' })
    return
  }

  try {
    const parsed = new URL(imageUrl)
    if (!ALLOWED_COVER_HOSTS.includes(parsed.hostname)) {
      res.status(403).json({ error: 'Host not allowed' })
      return
    }

    const response = await fetch(imageUrl, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })

    if (!response.ok || !response.body) {
      res.status(response.status).json({ error: 'Upstream fetch failed' })
      return
    }

    // 透传 content-type，设置缓存（封面图不会频繁变化）
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=86400') // 24h 缓存
    res.setHeader('Access-Control-Allow-Origin', '*')

    // Node 18+ fetch 返回 web ReadableStream，转换为 Node stream 流式输出
    const { Readable } = await import('stream')
    const nodeStream = Readable.fromWeb(response.body as import('stream/web').ReadableStream)
    nodeStream.pipe(res)
  } catch (err) {
    logger.error('Cover proxy failed', err)
    res.status(500).json({ error: 'Cover proxy failed' })
  }
})

export default router
