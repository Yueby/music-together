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
import { roomRepo } from '../repositories/roomRepository.js'
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
    const { source, keyword, limit: pageSize, page: pageNum, type } = data
    if (type === 'album') {
      const albums = await musicProvider.searchAlbum(source, keyword, pageSize, pageNum)
      res.json({ tracks: albums, page: pageNum, hasMore: albums.length >= pageSize })
    } else {
      const tracks = await musicProvider.search(source, keyword, pageSize, pageNum)
      res.json({ tracks, page: pageNum, hasMore: tracks.length >= pageSize })
    }
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

    if (!response.ok) {
      res.status(response.status).json({ error: 'Upstream fetch failed' })
      return
    }

    // 这里不要直接 pipe web stream。
    // 上游 CDN 超时/中断时，Readable 的异步 error 可能逃出当前 try/catch，导致 Node 进程崩溃。
    // 封面图体积小，直接读成 buffer 更稳，失败也会在当前 await 中被 catch。
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 透传 content-type，设置缓存（封面图不会频繁变化）
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Length', String(buffer.length))
    res.setHeader('Cache-Control', 'public, max-age=86400') // 24h 缓存
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(200).end(buffer)
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
