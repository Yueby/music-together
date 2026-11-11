import ncmApi from '@neteasecloudmusicapienhanced/api'
import type { MusicSource } from '@music-together/shared'
import { logger } from '../utils/logger.js'
import { withTimeoutOrNull } from '../utils/withTimeout.js'
import { getKrcByHash, krcToAmllLines, type AmllLyricLine } from './kugouLyricService.js'

export interface LyricResult {
  lyric: string
  tlyric: string
  romalrc: string
  yrc: string
  /** Word-by-word lines (Kugou KRC), when the platform has them. */
  wordByWord?: AmllLyricLine[]
}

/** The part of a Meting instance a lyric needs. */
export interface LyricSource {
  lyric(id: string): Promise<unknown>
}

const API_TIMEOUT_MS = 15_000

/** Meting answers `{ lyric, tlyric }` as JSON text; `null` for no answer in time or an unreadable one. */
async function metingLyric(meting: LyricSource, lyricId: string): Promise<LyricResult | null> {
  const raw = await withTimeoutOrNull(meting.lyric(lyricId), API_TIMEOUT_MS)
  if (raw === null || raw === undefined) return null
  try {
    const data = JSON.parse(raw as string) as Record<string, unknown>
    return { lyric: (data.lyric as string) || '', tlyric: (data.tlyric as string) || '', romalrc: '', yrc: '' }
  } catch {
    return null
  }
}

/**
 * Read one song's lyric from its platform: NetEase through its SDK (with the word-by-word YRC), QQ Music and Kugou
 * through Meting, Kugou plus its KRC word-by-word lines. `null` when nothing usable came back (timeout, unreadable
 * answer): the caller must not remember that. A hard failure throws.
 */
export async function fetchLyric(
  source: MusicSource,
  lyricId: string,
  meting: () => LyricSource,
): Promise<LyricResult | null> {
  if (source === 'netease') {
    // lyric_new carries the word-by-word lyric (YRC) as well
    const res = await withTimeoutOrNull(ncmApi.lyric_new({ id: lyricId }), API_TIMEOUT_MS)
    if (!res?.body) {
      logger.warn(`Lyric fetch timeout for ${source}: ${lyricId}`)
      return null
    }
    const body = res.body
    const result: LyricResult = {
      lyric: (body.lrc?.lyric as string) || '',
      tlyric: (body.tlyric?.lyric as string) || '',
      romalrc: ((body.romalrc as Record<string, unknown> | undefined)?.lyric as string) || '',
      yrc: (body.yrc?.lyric as string) || '',
    }
    if (result.yrc) logger.info(`YRC lyric found for netease:${lyricId}`)
    return result
  }

  const result = await metingLyric(meting(), lyricId)
  if (!result) {
    logger.warn(`Lyric fetch timeout for ${source}: ${lyricId}`)
    return null
  }

  if (source === 'kugou') {
    // KRC word-by-word lines on top of the LRC; any failure quietly leaves the plain lyric
    try {
      const krcInfo = await withTimeoutOrNull(getKrcByHash(lyricId), API_TIMEOUT_MS)
      if (krcInfo?.items?.length) {
        result.wordByWord = krcToAmllLines(krcInfo)
        logger.info(`KRC lyric found for kugou:${lyricId}`)
      }
    } catch {
      /* 静默回退到 LRC */
    }
  }
  return result
}
