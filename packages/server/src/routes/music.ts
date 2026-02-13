import { searchQuerySchema, urlQuerySchema, lyricQuerySchema, coverQuerySchema } from '@music-together/shared'
import { Router, type Router as RouterType } from 'express'
import { musicProvider } from '../services/musicProvider.js'
import { logger } from '../utils/logger.js'

const router: RouterType = Router()

router.get('/search', async (req, res) => {
  try {
    const parsed = searchQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid query parameters' })
      return
    }
    const { source, keyword, limit: pageSize, page: pageNum } = parsed.data

    const tracks = await musicProvider.search(source, keyword, pageSize, pageNum)

    res.json({ tracks, page: pageNum, hasMore: tracks.length >= pageSize })
  } catch (err) {
    logger.error('Search failed', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/url', async (req, res) => {
  try {
    const parsed = urlQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid query parameters' })
      return
    }
    const { source, urlId, bitrate } = parsed.data

    const url = await musicProvider.getStreamUrl(source, urlId, bitrate)

    res.json({ url })
  } catch (err) {
    logger.error('Get stream URL failed', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/lyric', async (req, res) => {
  try {
    const parsed = lyricQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid query parameters' })
      return
    }
    const { source, lyricId } = parsed.data

    const result = await musicProvider.getLyric(source, lyricId)
    res.json(result)
  } catch (err) {
    logger.error('Get lyric failed', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/cover', async (req, res) => {
  try {
    const parsed = coverQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid query parameters' })
      return
    }
    const { source, picId, size } = parsed.data

    const url = await musicProvider.getCover(source, picId, size)
    res.json({ url })
  } catch (err) {
    logger.error('Get cover failed', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
