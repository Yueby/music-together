import type { MusicSource } from '@music-together/shared'
import { Router, type Router as RouterType } from 'express'
import { musicProvider } from '../services/musicProvider.js'
import { logger } from '../utils/logger.js'

const router: RouterType = Router()

const VALID_SOURCES: MusicSource[] = ['netease', 'tencent', 'kugou', 'kuwo', 'baidu']

/** Safe parseInt with fallback */
function safeInt(value: unknown, fallback: number): number {
  if (value == null) return fallback
  const n = parseInt(String(value), 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

router.get('/search', async (req, res) => {
  try {
    const { source, keyword, limit, page } = req.query

    if (!source || !VALID_SOURCES.includes(source as MusicSource)) {
      res.status(400).json({ error: 'Invalid source. Must be one of: netease, tencent, kugou, kuwo, baidu' })
      return
    }

    if (!keyword || typeof keyword !== 'string') {
      res.status(400).json({ error: 'keyword is required' })
      return
    }

    const pageSize = safeInt(limit, 20)
    const pageNum = safeInt(page, 1)

    const tracks = await musicProvider.search(
      source as MusicSource,
      keyword,
      pageSize,
      pageNum,
    )

    res.json({ tracks, page: pageNum, hasMore: tracks.length >= pageSize })
  } catch (err) {
    logger.error('Search failed', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/url', async (req, res) => {
  try {
    const { source, urlId, bitrate } = req.query

    if (!source || !VALID_SOURCES.includes(source as MusicSource)) {
      res.status(400).json({ error: 'Invalid source' })
      return
    }

    if (!urlId) {
      res.status(400).json({ error: 'urlId is required' })
      return
    }

    const url = await musicProvider.getStreamUrl(
      source as MusicSource,
      urlId as string,
      safeInt(bitrate, 320),
    )

    res.json({ url })
  } catch (err) {
    logger.error('Get stream URL failed', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/lyric', async (req, res) => {
  try {
    const { source, lyricId } = req.query

    if (!source || !VALID_SOURCES.includes(source as MusicSource)) {
      res.status(400).json({ error: 'Invalid source' })
      return
    }

    if (!lyricId) {
      res.status(400).json({ error: 'lyricId is required' })
      return
    }

    const result = await musicProvider.getLyric(source as MusicSource, lyricId as string)
    res.json(result)
  } catch (err) {
    logger.error('Get lyric failed', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/cover', async (req, res) => {
  try {
    const { source, picId, size } = req.query

    if (!source || !VALID_SOURCES.includes(source as MusicSource)) {
      res.status(400).json({ error: 'Invalid source' })
      return
    }

    if (!picId) {
      res.status(400).json({ error: 'picId is required' })
      return
    }

    const url = await musicProvider.getCover(
      source as MusicSource,
      picId as string,
      safeInt(size, 300),
    )
    res.json({ url })
  } catch (err) {
    logger.error('Get cover failed', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
