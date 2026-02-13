import Meting from '@meting/core'
import type { MusicSource, Track } from '@music-together/shared'
import { nanoid } from 'nanoid'
import pLimit from 'p-limit'
import { logger } from '../utils/logger.js'

/** External API timeout (ms) */
const API_TIMEOUT_MS = 15_000

/** Race a promise against a timeout. Returns null on timeout. */
async function withTimeout<T>(promise: Promise<T>, ms = API_TIMEOUT_MS): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer!)
  }
}

// Path to song list in raw (non-formatted) API response per platform
const SEARCH_PATHS: Record<MusicSource, string> = {
  netease: 'result.songs',
  tencent: 'data.song.list',
  kugou: 'data.info',
}

class MusicProvider {
  // Shared instances with format(true) — used for url/lyric/cover operations (no cookie)
  private instances = new Map<MusicSource, any>()

  private getInstance(source: MusicSource) {
    if (!this.instances.has(source)) {
      const m = new Meting(source)
      m.format(true)
      this.instances.set(source, m)
    }
    return this.instances.get(source)!
  }

  /**
   * Search for tracks. Uses format(false) to get raw API data including duration,
   * then batch-resolves cover URLs.
   */
  async search(source: MusicSource, keyword: string, limit = 20, page = 1): Promise<Track[]> {
    try {
      // Fresh instance without format — gets raw API response with all fields
      const meting = new Meting(source)
      const raw = await withTimeout(meting.search(keyword, { limit, page }))
      if (raw === null) {
        logger.warn(`Search timeout for ${source}: "${keyword}"`)
        return []
      }

      let rawData: any
      try {
        rawData = JSON.parse(raw)
      } catch {
        logger.error(`Search JSON parse failed for ${source}`, raw?.substring?.(0, 200))
        return []
      }

      const songs = this.navigatePath(rawData, SEARCH_PATHS[source])
      if (!Array.isArray(songs) || songs.length === 0) return []

      const tracks = songs.map((song: any) => this.rawToTrack(song, source))

      // Batch resolve cover URLs for tracks that don't already have one
      await this.batchResolveCover(tracks, source)

      logger.info(`Search "${keyword}" on ${source}: ${tracks.length} results`)
      return tracks
    } catch (err) {
      logger.error(`Search failed for ${source}:`, err)
      return []
    }
  }

  /**
   * Get stream URL for a track. Optionally inject a cookie for VIP access.
   * When cookie is provided, a fresh Meting instance is created to avoid
   * polluting the shared cached instance.
   */
  async getStreamUrl(source: MusicSource, urlId: string, bitrate = 320, cookie?: string): Promise<string | null> {
    try {
      let meting: any
      if (cookie) {
        // Fresh instance with cookie — don't pollute the shared one
        meting = new Meting(source)
        meting.format(true)
        meting.cookie(cookie)
      } else {
        meting = this.getInstance(source)
      }
      const raw = await withTimeout(meting.url(urlId, bitrate))
      if (raw === null || raw === undefined) {
        logger.warn(`URL fetch timeout for ${source}: ${urlId}`)
        return null
      }
      let data: any
      try { data = JSON.parse(raw as string) } catch { return null }
      return data.url || null
    } catch (err) {
      logger.error(`Get URL failed for ${source}:`, err)
      return null
    }
  }

  async getLyric(source: MusicSource, lyricId: string): Promise<{ lyric: string; tlyric: string }> {
    try {
      const meting = this.getInstance(source)
      const raw = await withTimeout(meting.lyric(lyricId))
      if (raw === null || raw === undefined) {
        logger.warn(`Lyric fetch timeout for ${source}: ${lyricId}`)
        return { lyric: '', tlyric: '' }
      }
      let data: any
      try { data = JSON.parse(raw as string) } catch { return { lyric: '', tlyric: '' } }
      return {
        lyric: data.lyric || '',
        tlyric: data.tlyric || '',
      }
    } catch (err) {
      logger.error(`Get lyric failed for ${source}:`, err)
      return { lyric: '', tlyric: '' }
    }
  }

  async getCover(source: MusicSource, picId: string, size = 300): Promise<string> {
    try {
      const meting = this.getInstance(source)
      const raw = await withTimeout(meting.pic(picId, size))
      if (raw === null || raw === undefined) {
        logger.warn(`Cover fetch timeout for ${source}: ${picId}`)
        return ''
      }
      let data: any
      try { data = JSON.parse(raw as string) } catch { return '' }
      return data.url || ''
    } catch (err) {
      logger.error(`Get cover failed for ${source}:`, err)
      return ''
    }
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /** Navigate a dot-separated path in an object */
  private navigatePath(data: any, path: string): any {
    let result = data
    for (const key of path.split('.')) {
      result = result?.[key]
    }
    return result
  }

  /**
   * Convert raw platform-specific song data to our Track format.
   * Each platform returns different field names, so we need per-platform parsing.
   */
  private rawToTrack(song: any, source: MusicSource): Track {
    switch (source) {
      case 'netease': {
        const neteaseArtists = song.ar?.map((a: any) => a.name).filter(Boolean)
        return {
          id: nanoid(),
          title: song.name || 'Unknown',
          artist: neteaseArtists?.length ? neteaseArtists : ['Unknown'],
          album: song.al?.name || '',
          duration: Math.round((song.dt || 0) / 1000), // ms -> seconds
          cover: '', // resolved via pic()
          source,
          sourceId: String(song.id),
          urlId: String(song.id),
          lyricId: String(song.id),
          picId: String(song.al?.pic_str || song.al?.pic || ''),
          // fee: 0=免费, 1=VIP, 4=付费专辑, 8=低音质免费
          vip: song.fee === 1 || song.fee === 4 || song.privilege?.fee === 1 || song.privilege?.fee === 4,
        }
      }

      case 'tencent': {
        // Tencent sometimes wraps data in musicData
        const s = song.musicData || song
        return {
          id: nanoid(),
          title: s.name || 'Unknown',
          artist: (s.singer || []).map((a: any) => a.name),
          album: (s.album?.title || '').trim(),
          duration: s.interval || 0, // already in seconds
          cover: '', // resolved via pic()
          source,
          sourceId: String(s.mid),
          urlId: String(s.mid),
          lyricId: String(s.mid),
          picId: String(s.album?.mid || ''),
          // pay.pay_play=1 表示需要 VIP, pay.pay_month=1 表示月度VIP, pay.price_track>0 表示付费单曲
          vip: s.pay?.pay_play === 1 || s.pay?.pay_month === 1 || (s.pay?.price_track ?? 0) > 0,
        }
      }

      case 'kugou': {
        // Kugou encodes artist/title in filename: "Artist - Title"
        const filename = song.filename || song.fileName || ''
        const parts = filename.split(' - ')
        let trackName = filename
        let artists: string[] = []
        if (parts.length >= 2) {
          artists = parts[0].split('、').map((s: string) => s.trim())
          trackName = parts.slice(1).join(' - ')
        }
        return {
          id: nanoid(),
          title: trackName || 'Unknown',
          artist: artists.length > 0 ? artists : ['Unknown'],
          album: song.album_name || '',
          duration: song.duration || 0, // seconds
          cover: '', // resolved via pic() (requires API call)
          source,
          sourceId: String(song.hash),
          urlId: String(song.hash),
          lyricId: String(song.hash),
          picId: String(song.hash),
          // privilege 位掩码: & 8 表示 VIP; pay_type > 0 也表示付费
          vip: ((song.privilege ?? 0) & 8) !== 0 || (song.pay_type ?? 0) > 0,
        }
      }

      default:
        return {
          id: nanoid(),
          title: 'Unknown',
          artist: ['Unknown'],
          album: '',
          duration: 0,
          cover: '',
          source,
          sourceId: '',
          urlId: '',
        }
    }
  }

  /**
   * Batch-resolve cover URLs for tracks that don't have one.
   * - netease/tencent: pic() is pure URL generation (instant, no API call)
   * - kugou: pic() makes an API call per track (slower)
   *
   * Each pic() call uses a fresh Meting instance to avoid race conditions.
   */
  private async batchResolveCover(tracks: Track[], source: MusicSource): Promise<void> {
    const toResolve = tracks.filter((t) => !t.cover && t.picId)
    if (toResolve.length === 0) return

    // For platforms that need API calls, limit concurrency
    const needsApiCall = source === 'kugou'
    const limit = pLimit(needsApiCall ? 3 : toResolve.length)

    await Promise.allSettled(
      toResolve.map((track) =>
        limit(async () => {
          try {
            // Fresh instance per call to avoid shared state race conditions
            const instance = new Meting(source)
            const raw = await instance.pic(track.picId!, 300)
            const data = JSON.parse(raw)
            if (data.url) track.cover = data.url
          } catch {
            // Leave cover empty — frontend shows placeholder
          }
        }),
      ),
    )
  }
}

export const musicProvider = new MusicProvider()
