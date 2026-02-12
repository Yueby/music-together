import type { MusicSource } from '@music-together/shared'
import { Router, type Router as RouterType } from 'express'
import { musicProvider } from '../services/musicProvider.js'

const router: RouterType = Router()

const VALID_SOURCES: MusicSource[] = ['netease', 'tencent', 'kugou', 'kuwo', 'baidu']

router.get('/search', async (req, res) => {
  const { source, keyword, limit, page } = req.query

  if (!source || !VALID_SOURCES.includes(source as MusicSource)) {
    res.status(400).json({ error: 'Invalid source. Must be one of: netease, tencent, kugou, kuwo, baidu' })
    return
  }

  if (!keyword || typeof keyword !== 'string') {
    res.status(400).json({ error: 'keyword is required' })
    return
  }

  const pageSize = limit ? parseInt(limit as string, 10) : 20
  const pageNum = page ? parseInt(page as string, 10) : 1

  const tracks = await musicProvider.search(
    source as MusicSource,
    keyword,
    pageSize,
    pageNum,
  )

  res.json({ tracks, page: pageNum, hasMore: tracks.length >= pageSize })
})

router.get('/url', async (req, res) => {
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
    bitrate ? parseInt(bitrate as string, 10) : 320,
  )

  res.json({ url })
})

router.get('/lyric', async (req, res) => {
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
})

router.get('/cover', async (req, res) => {
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
    size ? parseInt(size as string, 10) : 300,
  )
  res.json({ url })
})

export default router
