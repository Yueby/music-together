import { searchQuerySchema, urlQuerySchema, lyricQuerySchema, coverQuerySchema, playlistQuerySchema } from '@music-together/shared'
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

router.get('/search', validated(searchQuerySchema, 'Search', async (data, _req, res) => {
  const { source, keyword, limit: pageSize, page: pageNum } = data
  const tracks = await musicProvider.search(source, keyword, pageSize, pageNum)
  res.json({ tracks, page: pageNum, hasMore: tracks.length >= pageSize })
}))

router.get('/url', validated(urlQuerySchema, 'Get stream URL', async (data, _req, res) => {
  const { source, urlId, bitrate } = data
  const url = await musicProvider.getStreamUrl(source, urlId, bitrate)
  res.json({ url })
}))

router.get('/lyric', validated(lyricQuerySchema, 'Get lyric', async (data, _req, res) => {
  const { source, lyricId } = data
  const result = await musicProvider.getLyric(source, lyricId)
  res.json(result)
}))

router.get('/cover', validated(coverQuerySchema, 'Get cover', async (data, _req, res) => {
  const { source, picId, size } = data
  const url = await musicProvider.getCover(source, picId, size)
  res.json({ url })
}))

router.get('/playlist', validated(playlistQuerySchema, 'Get playlist', async (data, _req, res) => {
  const { source, id, limit, offset, total, roomId, userId } = data
  const cookie = roomId && userId ? authService.getUserCookie(userId, source, roomId) : null
  const result = await musicProvider.getPlaylistPage(source, id, limit, offset, total, cookie)
  res.json({ tracks: result.tracks, total: result.total, offset, hasMore: result.hasMore })
}))

export default router
