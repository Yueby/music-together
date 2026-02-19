import Meting from '@meting/core'
import { get as kugouLrcGet, Format } from '@s4p/kugou-lrc'
import type { KrcInfo } from '@s4p/kugou-lrc'
import type { MusicSource, Track } from '@music-together/shared'
import { LRUCache } from 'lru-cache'
import { nanoid } from 'nanoid'
import pLimit from 'p-limit'
import { ncmApi } from './neteaseAuthService.js'
import * as kugouAuth from './kugouAuthService.js'
import { logger } from '../utils/logger.js'

/** AMLL LyricLine 格式（与 @applemusic-like-lyrics/core 一致，避免引入 client 依赖） */
interface AmllLyricLine {
  words: Array<{ word: string; startTime: number; endTime: number; romanWord: string; obscene: boolean }>
  translatedLyric: string
  romanLyric: string
  startTime: number
  endTime: number
  isBG: boolean
  isDuet: boolean
}

/** 将 KRC 解析结果转为 AMLL LyricLine 格式 */
function krcToAmllLines(krcInfo: KrcInfo): AmllLyricLine[] {
  if (!krcInfo.items?.length) return []
  return krcInfo.items.map((line) => {
    if (!line.length) {
      return {
        words: [],
        translatedLyric: '',
        romanLyric: '',
        startTime: 0,
        endTime: 0,
        isBG: false,
        isDuet: false,
      }
    }
    const words = line.map((w) => ({
      word: w.word,
      startTime: Math.round(w.offset * 1000),
      endTime: Math.round((w.offset + w.duration) * 1000),
      romanWord: '',
      obscene: false,
    }))
    const first = words[0]!
    const last = words[words.length - 1]!
    return {
      words,
      translatedLyric: '',
      romanLyric: '',
      startTime: first.startTime,
      endTime: last.endTime,
      isBG: false,
      isDuet: false,
    }
  })
}

// ---------------------------------------------------------------------------
// Meting instance type (library has no TS declarations)
// ---------------------------------------------------------------------------
type MetingInstance = InstanceType<typeof Meting>

/** Parsed JSON from Meting API responses */
type MetingJson = Record<string, unknown>

/** Loosely typed ncmApi response (the library has no TS declarations). */
interface NcmApiResponse {
  body?: {
    code?: number
    songs?: Record<string, unknown>[]
    playlist?: Record<string, unknown>[]
    [key: string]: unknown
  }
  [key: string]: unknown
}

/** External API timeout (ms) */
const API_TIMEOUT_MS = 15_000

/** Race a promise against a timeout. Returns null on timeout. */
async function withTimeout<T>(promise: Promise<T>, ms = API_TIMEOUT_MS): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

// Path to song list in raw (non-formatted) API response per platform
const SEARCH_PATHS: Record<MusicSource, string> = {
  netease: 'result.songs',
  tencent: 'data.song.list',
  kugou: 'data.info',
}

// Path to song list in raw playlist API response per platform
const PLAYLIST_PATHS: Record<MusicSource, string> = {
  netease: 'playlist.tracks', // Not used (Netease uses ncmApi)
  tencent: 'data.cdlist.0.songlist', // JS arrays support string numeric index
  kugou: 'data.info',
}

// ---------------------------------------------------------------------------
// Cache TTL constants
// ---------------------------------------------------------------------------
const HOUR = 60 * 60 * 1000
const MINUTE = 60 * 1000

// ---------------------------------------------------------------------------
// TrackMeta — Track without per-instance fields (id, requestedBy)
// ---------------------------------------------------------------------------
type TrackMeta = Omit<Track, 'id' | 'requestedBy'>

class MusicProvider {
  // Shared instances with format(true) — used for url/lyric/cover operations (no cookie)
  private instances = new Map<MusicSource, MetingInstance>()

  // ---------------------------------------------------------------------------
  // 3-Layer Cache Architecture
  // ---------------------------------------------------------------------------

  // Layer 1: Track Registry — single source of truth for all track metadata.
  // Every track that passes through the system (search, playlist) gets registered
  // here. Cross-context enrichment: search provides duration + cover, playlist
  // provides additional tracks. Merge strategy keeps the richest data.
  private trackRegistry = new LRUCache<string, TrackMeta>({
    max: 10_000,
    ttl: 2 * HOUR,
  })

  // Layer 2: Reference Indexes — store only sourceId arrays, NOT full Track objects.
  // Memory-efficient: a 2000-track playlist costs ~40KB (IDs) instead of ~1MB (Track[]).
  private searchIndex = new LRUCache<string, { source: MusicSource; ids: string[] }>({
    max: 200,
    ttl: 10 * MINUTE,
  })
  private playlistIndex = new LRUCache<string, { source: MusicSource; ids: string[] }>({
    max: 50,
    ttl: 30 * MINUTE,
  })

  // Layer 3: Resource Caches — scalar values for stream URLs, covers, lyrics.
  private streamUrlCache = new LRUCache<string, string>({ max: 500, ttl: 1 * HOUR })
  private coverCache = new LRUCache<string, string>({ max: 1000, ttl: 24 * HOUR })
  private lyricCache = new LRUCache<
    string,
    { lyric: string; tlyric: string; yrc: string; wordByWord?: AmllLyricLine[] }
  >({
    max: 500,
    ttl: 24 * HOUR,
  })

  private getInstance(source: MusicSource): MetingInstance {
    let m = this.instances.get(source)
    if (!m) {
      m = new Meting(source)
      m.format(true)
      this.instances.set(source, m)
    }
    return m
  }

  // ---------------------------------------------------------------------------
  // Track Registry helpers
  // ---------------------------------------------------------------------------

  /**
   * Register tracks into the registry, merging with existing data.
   * Merge strategy: keep the richer value for each field (non-empty wins).
   * This enables cross-context enrichment: search provides duration + cover,
   * playlist provides additional tracks, and both benefit from each other.
   */
  private registerTracks(tracks: Track[]): void {
    for (const t of tracks) {
      const key = `${t.source}:${t.sourceId}`
      const existing = this.trackRegistry.get(key)
      const { id: _id, requestedBy: _rb, ...meta } = t
      if (existing) {
        const merged: TrackMeta = {
          ...existing,
          cover: existing.cover || meta.cover,
          duration: existing.duration || meta.duration,
          vip: existing.vip || meta.vip,
        }
        this.trackRegistry.set(key, merged)
      } else {
        this.trackRegistry.set(key, meta)
      }
    }
  }

  /**
   * Enrich a track in-place from the registry (fill missing cover, duration, vip).
   * Called before caching playlist tracks so that previously-searched tracks
   * get their duration and cover carried over.
   */
  private enrichFromRegistry(track: Track): void {
    const cached = this.trackRegistry.get(`${track.source}:${track.sourceId}`)
    if (!cached) return
    if (!track.cover && cached.cover) track.cover = cached.cover
    if (!track.duration && cached.duration) track.duration = cached.duration
    if (!track.vip && cached.vip) track.vip = cached.vip
  }

  /**
   * Hydrate sourceId[] back into Track[] from the registry.
   * Returns null if ANY id is missing (registry eviction) — caller should
   * treat this as a cache miss and re-fetch from Meting.
   * Each hydrated Track gets a fresh nanoid for its `id` field.
   */
  private hydrateFromRegistry(source: MusicSource, ids: string[]): Track[] | null {
    const tracks: Track[] = []
    for (const sourceId of ids) {
      const meta = this.trackRegistry.get(`${source}:${sourceId}`)
      if (!meta) return null
      tracks.push({ ...meta, id: nanoid() })
    }
    return tracks
  }

  // ---------------------------------------------------------------------------
  // Public API — Search
  // ---------------------------------------------------------------------------

  /**
   * Search for tracks. Uses format(false) to get raw API data including duration,
   * then batch-resolves cover URLs.
   */
  async search(source: MusicSource, keyword: string, limit = 20, page = 1): Promise<Track[]> {
    const cacheKey = `${source}:${keyword}:${limit}:${page}`

    // Check reference index
    const indexed = this.searchIndex.get(cacheKey)
    if (indexed) {
      const hydrated = this.hydrateFromRegistry(indexed.source, indexed.ids)
      if (hydrated) {
        logger.info(`Search cache hit: "${keyword}" on ${source} (page ${page})`)
        return hydrated
      }
      // Registry eviction — stale index, fall through to re-fetch
      this.searchIndex.delete(cacheKey)
      logger.info(`Search index stale (registry eviction): "${keyword}" on ${source}`)
    }

    try {
      // Fresh instance without format — gets raw API response with all fields
      const meting = new Meting(source)
      const raw = await withTimeout(meting.search(keyword, { limit, page }))
      if (raw === null) {
        logger.warn(`Search timeout for ${source}: "${keyword}"`)
        return []
      }

      let rawData: MetingJson
      try {
        rawData = JSON.parse(raw) as MetingJson
      } catch {
        logger.error(`Search JSON parse failed for ${source}`, raw?.substring?.(0, 200))
        return []
      }

      const songs = this.navigatePath(rawData, SEARCH_PATHS[source])
      if (!Array.isArray(songs) || songs.length === 0) return []

      const tracks = songs.map((song: MetingJson) => this.rawToTrack(song, source))

      // Batch resolve cover URLs for tracks that don't already have one
      await this.batchResolveCover(tracks, source)

      // Register into Layer 1 and index into Layer 2
      this.registerTracks(tracks)
      this.searchIndex.set(cacheKey, {
        source,
        ids: tracks.map((t) => t.sourceId),
      })

      logger.info(`Search "${keyword}" on ${source}: ${tracks.length} results`)
      return tracks
    } catch (err) {
      logger.error(`Search failed for ${source}:`, err)
      return []
    }
  }

  // ---------------------------------------------------------------------------
  // Public API — Stream URL, Lyric, Cover (unchanged from original)
  // ---------------------------------------------------------------------------

  /**
   * Get stream URL for a track. Optionally inject a cookie for VIP access.
   * When cookie is provided, a fresh Meting instance is created to avoid
   * polluting the shared cached instance — and the result is NOT cached
   * because VIP URLs are user-specific.
   */
  async getStreamUrl(source: MusicSource, urlId: string, bitrate = 320, cookie?: string): Promise<string | null> {
    // Skip cache when cookie is provided (VIP URLs are user-specific)
    if (!cookie) {
      const cacheKey = `${source}:${urlId}:${bitrate}`
      const cached = this.streamUrlCache.get(cacheKey)
      if (cached) {
        logger.info(`Stream URL cache hit: ${source}/${urlId}`)
        return cached
      }
    }

    try {
      let meting: MetingInstance
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
      let data: MetingJson
      try {
        data = JSON.parse(raw as string) as MetingJson
      } catch {
        return null
      }
      let url = (data.url as string) || null
      // 强制 HTTPS，避免 HTTPS 页面加载 HTTP 音频触发 Mixed Content 警告
      if (url?.startsWith('http://')) {
        url = url.replace(/^http:\/\//, 'https://')
      }

      // Only cache non-cookie & successful results (null = transient failure, retry next time)
      if (!cookie && url) {
        this.streamUrlCache.set(`${source}:${urlId}:${bitrate}`, url)
      }

      return url
    } catch (err) {
      logger.error(`Get URL failed for ${source}:`, err)
      return null
    }
  }

  async getLyric(
    source: MusicSource,
    lyricId: string,
  ): Promise<{ lyric: string; tlyric: string; yrc: string; wordByWord?: AmllLyricLine[] }> {
    const cacheKey = `${source}:${lyricId}`
    const cached = this.lyricCache.get(cacheKey)
    if (cached) {
      logger.info(`Lyric cache hit: ${source}/${lyricId}`)
      return cached
    }

    const empty = { lyric: '', tlyric: '', yrc: '' as string }

    try {
      let result: { lyric: string; tlyric: string; yrc: string; wordByWord?: AmllLyricLine[] } = {
        ...empty,
      }

      if (source === 'netease') {
        // 使用 ncmApi.lyric_new 获取包含逐词歌词 (YRC) 的完整响应
        const res = await withTimeout(ncmApi.lyric_new({ id: lyricId }) as Promise<NcmApiResponse>)
        if (!res?.body) {
          logger.warn(`Lyric fetch timeout for ${source}: ${lyricId}`)
          return empty
        }
        const body = res.body as Record<string, Record<string, unknown> | undefined>
        result = {
          lyric: (body.lrc?.lyric as string) || '',
          tlyric: (body.tlyric?.lyric as string) || '',
          yrc: (body.yrc?.lyric as string) || '',
        }
        if (result.yrc) {
          logger.info(`YRC lyric found for netease:${lyricId}`)
        }
      } else if (source === 'kugou') {
        // 酷狗：Meting 获取 LRC + kugou-lrc 获取 KRC 逐字歌词
        const meting = this.getInstance(source)
        const raw = await withTimeout(meting.lyric(lyricId))
        if (raw === null || raw === undefined) {
          logger.warn(`Lyric fetch timeout for ${source}: ${lyricId}`)
          return empty
        }
        try {
          const data = JSON.parse(raw as string) as MetingJson
          result = {
            lyric: (data.lyric as string) || '',
            tlyric: (data.tlyric as string) || '',
            yrc: '',
          }
        } catch {
          return empty
        }
        // 尝试获取 KRC 逐字歌词
        try {
          const krcInfo = await withTimeout(kugouLrcGet({ hash: lyricId, fmt: Format.krc }))
          if (krcInfo?.items?.length) {
            result.wordByWord = krcToAmllLines(krcInfo)
            logger.info(`KRC lyric found for kugou:${lyricId}`)
          }
        } catch { /* 静默回退到 LRC */ }
      } else {
        // QQ 音乐：使用 Meting 默认流程
        const meting = this.getInstance(source)
        const raw = await withTimeout(meting.lyric(lyricId))
        if (raw === null || raw === undefined) {
          logger.warn(`Lyric fetch timeout for ${source}: ${lyricId}`)
          return empty
        }
        try {
          const data = JSON.parse(raw as string) as MetingJson
          result = {
            lyric: (data.lyric as string) || '',
            tlyric: (data.tlyric as string) || '',
            yrc: '',
          }
        } catch {
          return empty
        }
      }

      this.lyricCache.set(cacheKey, result)
      return result
    } catch (err) {
      logger.error(`Get lyric failed for ${source}:`, err)
      return empty
    }
  }

  async getCover(source: MusicSource, picId: string, size = 300): Promise<string> {
    const cacheKey = `${source}:${picId}:${size}`
    const cached = this.coverCache.get(cacheKey)
    if (cached !== undefined) {
      return cached
    }

    try {
      const meting = this.getInstance(source)
      const raw = await withTimeout(meting.pic(picId, size))
      if (raw === null || raw === undefined) {
        logger.warn(`Cover fetch timeout for ${source}: ${picId}`)
        return ''
      }
      let data: MetingJson
      try {
        data = JSON.parse(raw as string) as MetingJson
      } catch {
        return ''
      }
      const url = (data.url as string) || ''

      this.coverCache.set(cacheKey, url)
      return url
    } catch (err) {
      logger.error(`Get cover failed for ${source}:`, err)
      return ''
    }
  }

  // ---------------------------------------------------------------------------
  // Public API — Playlist (new: paginated)
  // ---------------------------------------------------------------------------

  /**
   * Ensure a playlist's track IDs are in the registry + index.
   * Does NOT resolve covers (that's deferred to getPlaylistPage).
   * Returns the full sourceId list and total count.
   */
  async fetchFullPlaylist(
    source: MusicSource,
    playlistId: string,
    playlistTotal?: number,
    cookie?: string | null,
  ): Promise<{ ids: string[]; total: number }> {
    const cacheKey = `${source}:${playlistId}`

    // Check reference index — verify registry still has all tracks
    const indexed = this.playlistIndex.get(cacheKey)
    if (indexed) {
      const allPresent = indexed.ids.every((id) => this.trackRegistry.get(`${indexed.source}:${id}`) !== undefined)
      if (allPresent) {
        logger.info(`Playlist index hit: ${source}/${playlistId} (${indexed.ids.length} tracks)`)
        return { ids: indexed.ids, total: indexed.ids.length }
      }
      this.playlistIndex.delete(cacheKey)
      logger.info(`Playlist index stale (registry eviction): ${source}/${playlistId}`)
    }

    // Netease: use ncmApi.playlist_track_all to bypass Meting's 1000-track limit
    if (source === 'netease') {
      return this.fetchNeteasePlaylist(playlistId, cacheKey, playlistTotal, cookie)
    }

    // Kugou: try native API (works with global_collection_id from user playlists)
    // Falls back to Meting for public playlists / special IDs
    if (source === 'kugou') {
      const result = await this.fetchKugouPlaylist(playlistId, cacheKey, cookie)
      if (result.total > 0) return result
      logger.info(`Kugou native API returned empty for ${playlistId}, falling back to Meting`)
    }

    // Tencent (and Kugou fallback): use Meting raw mode
    return this.fetchMetingPlaylist(source, playlistId, cacheKey)
  }

  /**
   * Fetch full Netease playlist via ncmApi.playlist_track_all.
   * No 1000-track limit; returns full song data including duration/album/artist.
   */
  private async fetchNeteasePlaylist(
    playlistId: string,
    cacheKey: string,
    playlistTotal?: number,
    cookie?: string | null,
  ): Promise<{ ids: string[]; total: number }> {
    // Netease /api/v3/song/detail can't handle more than ~1000 IDs per request,
    // so we paginate through playlist_track_all in chunks of 1000.
    const CHUNK_SIZE = 1000
    const totalToFetch = playlistTotal || 100000
    const baseParams = { id: playlistId, timestamp: Date.now(), ...(cookie ? { cookie } : {}) }

    try {
      const allTracks: Track[] = []
      let offset = 0

      while (offset < totalToFetch) {
        const res = (await withTimeout(
          ncmApi.playlist_track_all({ ...baseParams, limit: CHUNK_SIZE, offset } as Record<string, unknown>),
          60_000,
        )) as NcmApiResponse | null

        if (res === null) {
          logger.warn(`Netease playlist_track_all timeout: ${playlistId} (offset=${offset})`)
          break
        }

        const songs = res?.body?.songs
        if (!Array.isArray(songs) || songs.length === 0) {
          if (offset === 0) {
            logger.warn(`Netease playlist_track_all empty: ${playlistId}`, { code: res?.body?.code })
            return { ids: [], total: 0 }
          }
          break
        }

        const chunk = songs.map((song: Record<string, unknown>) => this.rawToTrack(song, 'netease'))
        allTracks.push(...chunk)

        // If we got fewer than CHUNK_SIZE, we've reached the end
        if (songs.length < CHUNK_SIZE) break
        offset += CHUNK_SIZE
      }

      if (allTracks.length === 0) return { ids: [], total: 0 }

      for (const t of allTracks) this.enrichFromRegistry(t)
      this.registerTracks(allTracks)

      const ids = allTracks.map((t) => t.sourceId)
      this.playlistIndex.set(cacheKey, { source: 'netease', ids })

      logger.info(
        `Netease playlist ${playlistId}: ${ids.length} tracks (via ncmApi, ${Math.ceil(ids.length / CHUNK_SIZE)} chunks)`,
      )
      return { ids, total: ids.length }
    } catch (err) {
      logger.error(`Netease playlist_track_all failed: ${playlistId}`, err)
      return { ids: [], total: 0 }
    }
  }

  /**
   * Fetch kugou playlist via native kugou API (global_collection_id).
   * Supports user playlists that Meting cannot access.
   */
  private async fetchKugouPlaylist(
    playlistId: string,
    cacheKey: string,
    cookie?: string | null,
  ): Promise<{ ids: string[]; total: number }> {
    try {
      const PAGE_SIZE = 300
      const allTracks: Track[] = []
      let page = 1
      let totalFromApi = 0

      // Paginate until all tracks are fetched
      while (true) {
        const { songs, total } = await kugouAuth.getPlaylistTracks(playlistId, page, PAGE_SIZE, cookie)
        if (page === 1) totalFromApi = total

        if (songs.length === 0) break

        for (const song of songs) {
          const track = this.kugouSongToTrack(song)
          if (track) allTracks.push(track)
        }

        if (allTracks.length >= totalFromApi || songs.length < PAGE_SIZE) break
        page++
      }

      if (allTracks.length === 0) return { ids: [], total: 0 }

      for (const t of allTracks) this.enrichFromRegistry(t)
      this.registerTracks(allTracks)

      const ids = allTracks.map((t) => t.sourceId)
      this.playlistIndex.set(cacheKey, { source: 'kugou', ids })

      logger.info(`Kugou playlist ${playlistId}: ${ids.length} tracks (via native API, ${page} pages)`)
      return { ids, total: ids.length }
    } catch (err) {
      logger.error(`Kugou playlist fetch failed: ${playlistId}`, err)
      return { ids: [], total: 0 }
    }
  }

  /** Convert a kugou song object from getPlaylistTracks to a Track. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- external Kugou API response shape
  private kugouSongToTrack(song: Record<string, unknown>): Track | null {
    // Cast for convenient dynamic property access
    const song_ = song as Record<string, any>
    const hash = song_.hash || song_.audio_info?.hash || ''
    if (!hash) return null

    // filename is typically "Artist - Title" or "Artist1、Artist2 - Title"
    const filename = String(song_.filename || song_.name || '')
    const parts = filename.split(' - ')
    const artistStr = parts.length > 1 ? parts[0].trim() : ''
    const artists = artistStr
      ? artistStr
          .split(/[、,，&]/)
          .map((a: string) => a.trim())
          .filter(Boolean)
      : []
    const title = parts.length > 1 ? parts.slice(1).join(' - ').trim() : filename

    // Duration: Kugou's native API returns seconds (e.g. 240), but some endpoints
    // return milliseconds (e.g. 240000). Threshold 100000 (~27 hours in seconds)
    // safely distinguishes the two — any value above it is assumed to be milliseconds.
    let duration = Number(song_.duration ?? song_.timelen ?? 0)
    if (duration > 100000) duration = Math.floor(duration / 1000)

    // VIP / privilege
    const privilege = song_.privilege ?? song_.pay_type ?? 0
    const isVip = privilege > 0

    return {
      id: nanoid(),
      source: 'kugou',
      sourceId: hash,
      title,
      artist: artists,
      album: String(song_.album_name || song_.remark || ''),
      duration,
      cover: '',
      lyricId: hash,
      urlId: hash,
      picId: hash,
      vip: isVip,
    }
  }

  /**
   * Fetch playlist via Meting raw mode — used for Tencent/Kugou.
   * Raw mode preserves VIP/pay fields and duration (format mode strips them).
   */
  private async fetchMetingPlaylist(
    source: MusicSource,
    playlistId: string,
    cacheKey: string,
  ): Promise<{ ids: string[]; total: number }> {
    try {
      const meting = new Meting(source)
      const raw = await withTimeout(meting.playlist(playlistId), 30_000)
      if (raw === null) {
        logger.warn(`Playlist fetch timeout for ${source}: ${playlistId}`)
        return { ids: [], total: 0 }
      }

      let rawData: MetingJson
      try {
        rawData = JSON.parse(raw as string) as MetingJson
      } catch {
        logger.error(`Playlist JSON parse failed for ${source}`, (raw as string)?.substring?.(0, 200))
        return { ids: [], total: 0 }
      }

      const songs = this.navigatePath(rawData, PLAYLIST_PATHS[source])
      if (!Array.isArray(songs) || songs.length === 0) return { ids: [], total: 0 }

      const tracks = songs.map((song: MetingJson) => this.rawToTrack(song, source))
      for (const t of tracks) this.enrichFromRegistry(t)
      this.registerTracks(tracks)

      const ids = tracks.map((t) => t.sourceId)
      this.playlistIndex.set(cacheKey, { source, ids })

      logger.info(`Playlist ${playlistId} on ${source}: ${tracks.length} tracks (raw mode)`)
      return { ids, total: ids.length }
    } catch (err) {
      logger.error(`Get playlist failed for ${source}:`, err)
      return { ids: [], total: 0 }
    }
  }

  /**
   * Get a paginated slice of a playlist's tracks.
   * Covers are resolved only for the requested page, not the entire playlist.
   * After resolution, covers are written back to the registry for future reuse.
   */
  async getPlaylistPage(
    source: MusicSource,
    playlistId: string,
    limit: number,
    offset: number,
    playlistTotal?: number,
    cookie?: string | null,
  ): Promise<{ tracks: Track[]; total: number; hasMore: boolean }> {
    const { ids, total } = await this.fetchFullPlaylist(source, playlistId, playlistTotal, cookie)
    if (total === 0) return { tracks: [], total: 0, hasMore: false }

    const pageIds = ids.slice(offset, offset + limit)

    // Hydrate page from registry
    let tracks = this.hydrateFromRegistry(source, pageIds)
    if (!tracks) {
      // Registry eviction between fetchFullPlaylist and hydrate (very rare).
      // Clear index and retry once.
      this.playlistIndex.delete(`${source}:${playlistId}`)
      logger.warn(`Playlist page hydration failed, retrying: ${source}/${playlistId}`)
      const retry = await this.fetchFullPlaylist(source, playlistId, playlistTotal, cookie)
      if (retry.total === 0) return { tracks: [], total: 0, hasMore: false }
      const retryPageIds = retry.ids.slice(offset, offset + limit)
      tracks = this.hydrateFromRegistry(source, retryPageIds)
      if (!tracks) {
        logger.error(`Playlist page hydration failed after retry: ${source}/${playlistId}`)
        return { tracks: [], total: retry.total, hasMore: offset + limit < retry.total }
      }
    }

    // Resolve covers for this page only (tracks with cover already set are skipped)
    await this.batchResolveCover(tracks, source)

    // Write newly resolved covers back to registry for cross-page / cross-context reuse
    this.registerTracks(tracks)

    return { tracks, total, hasMore: offset + limit < total }
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /** Navigate a dot-separated path in an object */
  private navigatePath(data: MetingJson, path: string): unknown {
    let result: unknown = data
    for (const key of path.split('.')) {
      result = (result as Record<string, unknown>)?.[key]
    }
    return result
  }

  /**
   * Convert raw platform-specific song data to our Track format.
   * Each platform returns different field names, so we need per-platform parsing.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- platform API shapes are too dynamic for strict typing
  private rawToTrack(song: Record<string, unknown>, source: MusicSource): Track {
    // Cast to any for convenient dynamic property access on external API responses
    const s = song as Record<string, any>
    switch (source) {
      case 'netease': {
        const neteaseArtists = s.ar?.map((a: Record<string, unknown>) => a.name).filter(Boolean)
        return {
          id: nanoid(),
          title: s.name || 'Unknown',
          artist: neteaseArtists?.length ? neteaseArtists : ['Unknown'],
          album: s.al?.name || '',
          duration: Math.round((s.dt || 0) / 1000), // ms -> seconds
          cover: '', // resolved via pic()
          source,
          sourceId: String(s.id),
          urlId: String(s.id),
          lyricId: String(s.id),
          picId: String(s.al?.pic_str || s.al?.pic || ''),
          // fee: 0=免费, 1=VIP, 4=付费专辑, 8=低音质免费
          vip: s.fee === 1 || s.fee === 4 || s.privilege?.fee === 1 || s.privilege?.fee === 4,
        }
      }

      case 'tencent': {
        // Tencent sometimes wraps data in musicData
        const t = s.musicData || s
        return {
          id: nanoid(),
          title: t.name || 'Unknown',
          artist: (t.singer || []).map((a: Record<string, unknown>) => a.name),
          album: (t.album?.title || '').trim(),
          duration: t.interval || 0, // already in seconds
          cover: '', // resolved via pic()
          source,
          sourceId: String(t.mid),
          urlId: String(t.mid),
          lyricId: String(t.mid),
          picId: String(t.album?.mid || ''),
          // pay.pay_play=1 表示需要 VIP, pay.pay_month=1 表示月度VIP, pay.price_track>0 表示付费单曲
          vip: t.pay?.pay_play === 1 || t.pay?.pay_month === 1 || (t.pay?.price_track ?? 0) > 0,
        }
      }

      case 'kugou': {
        // Kugou encodes artist/title in filename: "Artist - Title"
        const filename = s.filename || s.fileName || ''
        const parts = filename.split(' - ')
        let trackName = filename
        let artists: string[] = []
        if (parts.length >= 2) {
          artists = parts[0]
            .split(/[、,，&]/)
            .map((a: string) => a.trim())
            .filter(Boolean)
          trackName = parts.slice(1).join(' - ')
        }
        return {
          id: nanoid(),
          title: trackName || 'Unknown',
          artist: artists.length > 0 ? artists : ['Unknown'],
          album: s.album_name || '',
          duration: s.duration || 0, // seconds
          cover: '', // resolved via pic() (requires API call)
          source,
          sourceId: String(s.hash),
          urlId: String(s.hash),
          lyricId: String(s.hash),
          picId: String(s.hash),
          // privilege 位掩码: & 8 表示 VIP; pay_type > 0 也表示付费
          vip: ((s.privilege ?? 0) & 8) !== 0 || (s.pay_type ?? 0) > 0,
        }
      }

      default: {
        // Exhaustive check — if a new MusicSource is added, TypeScript will error here
        const _exhaustive: never = source
        throw new Error(`Unsupported music source: ${_exhaustive}`)
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
          // Check cover cache first
          const cacheKey = `${source}:${track.picId!}:300`
          const cached = this.coverCache.get(cacheKey)
          if (cached !== undefined) {
            track.cover = cached
            return
          }

          try {
            // Fresh instance per call to avoid shared state race conditions
            const instance = new Meting(source)
            const raw = await instance.pic(track.picId!, 300)
            const data = JSON.parse(raw)
            if (data.url) {
              track.cover = data.url
              this.coverCache.set(cacheKey, data.url)
            }
          } catch {
            // Leave cover empty — frontend shows placeholder
          }
        }),
      ),
    )
  }
}

export const musicProvider = new MusicProvider()
