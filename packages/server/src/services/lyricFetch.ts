import ncmApi from '@neteasecloudmusicapienhanced/api'
import type { MusicSource } from '@music-together/shared'
import { logger } from '../utils/logger.js'
import { withTimeout, withTimeoutOrNull } from '../utils/withTimeout.js'
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

/** A lyric that was read, and whether it is complete enough to be remembered by the caller. */
export interface FetchedLyric {
  result: LyricResult
  /** False for a degraded answer (e.g. Kugou's plain LRC after its KRC lookup failed): serve it, but do not cache it. */
  cacheable: boolean
}

/**
 * Read one song's lyric from its platform: NetEase through its SDK (with the word-by-word YRC), QQ Music and Kugou
 * through Meting, Kugou plus its KRC word-by-word lines. `null` when nothing usable came back (timeout, refusal,
 * unreadable or empty answer): the caller must not remember that. A hard failure throws. A degraded answer is returned
 * with `cacheable: false`.
 */
export async function fetchLyric(
  source: MusicSource,
  lyricId: string,
  meting: () => LyricSource,
): Promise<FetchedLyric | null> {
  if (source === 'netease') {
    // lyric_new carries the word-by-word lyric (YRC) as well
    const res = await withTimeoutOrNull(ncmApi.lyric_new({ id: lyricId }), API_TIMEOUT_MS)
    if (!res?.body) {
      logger.warn(`Lyric fetch timeout for ${source}: ${lyricId}`)
      return null
    }
    const body = res.body
    // A business code other than 200 is a refusal (rate limiting, ...), not a song without lyric.
    if (body.code !== undefined && body.code !== 200) {
      logger.warn(`Lyric fetch for ${source}: ${lyricId} returned business code`, { code: body.code })
      return null
    }
    const result: LyricResult = {
      lyric: (body.lrc?.lyric as string) || '',
      tlyric: (body.tlyric?.lyric as string) || '',
      romalrc: ((body.romalrc as Record<string, unknown> | undefined)?.lyric as string) || '',
      yrc: (body.yrc?.lyric as string) || '',
    }
    if (result.yrc) logger.info(`YRC lyric found for netease:${lyricId}`)
    return { result, cacheable: true }
  }

  const result = await metingLyric(meting(), lyricId)
  if (!result) {
    logger.warn(`Lyric fetch timeout for ${source}: ${lyricId}`)
    return null
  }

  let cacheable = true
  if (source === 'kugou') {
    // KRC word-by-word lines on top of the LRC. A failing or slow KRC lookup quietly leaves the plain lyric, but that
    // degraded answer is not remembered: the next play should get the word-by-word lines if Kugou has recovered.
    // `null` / no lines from a lookup that did answer means the song has no KRC, which is a real (cacheable) answer.
    try {
      const krcInfo = await withTimeout(getKrcByHash(lyricId), API_TIMEOUT_MS, new Error('KRC lookup timeout'))
      if (krcInfo?.items?.length) {
        result.wordByWord = krcToAmllLines(krcInfo)
        logger.info(`KRC lyric found for kugou:${lyricId}`)
      }
    } catch {
      cacheable = false
      /* 静默回退到 LRC */
    }
  }

  // Nothing readable at all (an empty LRC and no word-by-word lines) may just be a bad moment upstream.
  if (!result.lyric && !result.wordByWord?.length) return null
  return { result, cacheable }
}
