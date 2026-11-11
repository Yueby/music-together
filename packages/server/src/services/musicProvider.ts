import { createHash } from 'node:crypto'
import Meting from '@meting/core'
import { UNKNOWN_ARTIST } from '@music-together/shared'
import type { MusicSource, Playlist, Track } from '@music-together/shared'
import { LRUCache } from 'lru-cache'
import { nanoid } from 'nanoid'
import pLimit from 'p-limit'
import ncmApi from '@neteasecloudmusicapienhanced/api'
import * as kugouAuth from './kugouAuthService.js'
import { fetchLyric, type LyricResult } from './lyricFetch.js'
import * as tencentAuth from './tencentAuthService.js'
import { logger } from '../utils/logger.js'
import { withTimeoutOrNull } from '../utils/withTimeout.js'
import { searchAlbums, searchPlaylists } from './catalogSearch.js'
import { SearchError } from './catalogUtils.js'
import { kugouSongToTrack, navigatePath, rawToTrack } from './trackMapping.js'
import { deriveThumbnailCoverUrl, normalizeKugouTemplateCoverUrl, normalizeNeteaseCoverUrl } from './coverUrls.js'
import { getStreamUrlCacheTtl, isStreamUrlExpired } from './streamUrlLifetime.js'
import { getNeteasePlaybackUrl } from './neteasePlayback.js'

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

/** Tencent 新版搜索 API 响应结构 */
interface TencentSearchData {
  body: {
    song: {
      list: TencentSearchSong[]
    }
  }
  meta: {
    curpage: number
    perpage: number
    sum: number
    nextpage: number
  }
}

/** Tencent 搜索结果单曲结构 */
interface TencentSearchSong {
  id: number
  mid: string
  name: string
  title?: string
  interval: number
  singer: Array<{ id: number; mid: string; name: string }>
  album?: {
    id: number
    mid: string
    name: string
    pmid?: string
  }
  file?: {
    media_mid?: string
    size_128mp3?: number
    size_320mp3?: number
    size_flac?: number
  }
  pay?: {
    pay_down?: number
    pay_month?: number
    pay_play?: number
    price_track?: number
  }
  action?: {
    msgpay?: number
  }
}

/** External API timeout (ms) */
const API_TIMEOUT_MS = 15_000

/**
 * Key of the cached id list of a playlist or album. It must separate:
 * - kinds: an album and a playlist can share a numeric id on the same platform;
 * - credentials: a list fetched with a user's cookie can include private tracks and must never be served to
 *   anyone else, so each distinct cookie gets its own entry (only a short hash of it is kept, never the cookie).
 */
export function playlistCacheKey(
  source: MusicSource,
  playlistId: string,
  type: 'playlist' | 'album',
  cookie?: string | null,
): string {
  const scope = cookie ? `u${createHash('sha256').update(cookie).digest('hex').slice(0, 16)}` : 'public'
  return `${source}:${type}:${scope}:${playlistId}`
}

/** Run fetch factories with an abort signal; legacy SDK promises still use a bounded wait. A timeout answers `null`. */
const withTimeout = <T>(work: Promise<T> | ((signal: AbortSignal) => Promise<T>), ms = API_TIMEOUT_MS) =>
  withTimeoutOrNull(work, ms)

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

const EMPTY_LYRIC: LyricResult = { lyric: '', tlyric: '', romalrc: '', yrc: '' }

/** Meting's providers do not share a useful maximum artwork request size. */
const COVER_REQUEST_SIZES: Record<MusicSource, number> = {
  netease: 800,
  tencent: 800,
  kugou: 5000,
}

function getCoverRequestSize(source: MusicSource, size?: number): number {
  return size ?? COVER_REQUEST_SIZES[source]
}

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
  private lyricCache = new LRUCache<string, LyricResult>({
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
      if (meta.cover) meta.thumbnailCover = deriveThumbnailCoverUrl(meta.source, meta.cover)
      if (existing) {
        const merged: TrackMeta = {
          ...existing,
          cover: existing.cover || meta.cover,
          thumbnailCover: existing.cover
            ? deriveThumbnailCoverUrl(existing.source, existing.cover)
            : meta.thumbnailCover,
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
    if (track.cover) track.thumbnailCover = deriveThumbnailCoverUrl(track.source, track.cover)
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
       const track = { ...meta, id: nanoid() }
       if (track.cover) track.thumbnailCover = deriveThumbnailCoverUrl(source, track.cover)
       tracks.push(track)
    }
    return tracks
  }

  /**
   * Turn raw NetEase songs (`ar` / `al` shape, as returned by artist pages and recommendations) into Tracks that are
   * registered like search results, so queueing them later is enriched exactly the same way. Entries without a usable
   * id are dropped; the album artwork URL the response already carries saves a per-track cover lookup.
   */
  ingestNeteaseSongs(songs: unknown): Track[] {
    if (!Array.isArray(songs)) return []
    const tracks: Track[] = []
    for (const song of songs) {
      if (typeof song !== 'object' || song === null) continue
      const raw = song as Record<string, any>
      if (raw.id === undefined || raw.id === null) continue
      const track = rawToTrack(raw, 'netease')
      const picUrl = raw.al?.picUrl
      if (typeof picUrl === 'string' && picUrl) {
        track.cover = normalizeNeteaseCoverUrl(picUrl)
        track.thumbnailCover = deriveThumbnailCoverUrl('netease', track.cover)
      }
      tracks.push(track)
    }
    for (const track of tracks) this.enrichFromRegistry(track)
    this.registerTracks(tracks)
    return tracks
  }

  // ---------------------------------------------------------------------------
  // Public API — Search
  // ---------------------------------------------------------------------------

  /**
   * Search Tencent (QQ 音乐) using the new Desktop API.
   * The legacy Meting API returns empty results, so we use the direct API.
   */
  private async searchTencent(keyword: string, limit = 20, page = 1): Promise<Track[]> {
    // Early Exit: empty keyword
    if (!keyword.trim()) return []

    try {
      const response = await withTimeout(
        tencentAuth.requestSignedApi<TencentSearchData>({
          module: 'music.search.SearchCgiService',
          method: 'DoSearchForQQMusicDesktop',
          comm: {
            ct: 19,
            cv: 2201,
          },
          param: {
            num_per_page: limit,
            page_num: page,
            search_type: 0,
            query: keyword,
            grp: 1,
          },
        }),
      )

      // Fail Fast: timeout or null response
      if (!response) {
        logger.warn(`Tencent search timeout for "${keyword}"`)
        throw new SearchError()
      }

      const songList = response.body?.song?.list
      if (!Array.isArray(songList)) {
        logger.warn(`Tencent search returned an invalid song list for "${keyword}"`)
        throw new SearchError()
      }

      // Transform to Track format (Atomic Predictability: pure transformation)
      const tracks: Track[] = songList.map((song) => ({
        id: nanoid(),
        source: 'tencent' as const,
        sourceId: song.mid,
        title: song.name || song.title || 'Unknown',
        artist: song.singer?.map((s) => s.name).filter(Boolean) || ['Unknown'],
        album: song.album?.name || '',
        duration: song.interval || 0, // already in seconds
         cover: song.album?.pmid ? `https://y.gtimg.cn/music/photo_new/T002R800x800M000${song.album.pmid}.jpg` : '',
         thumbnailCover: song.album?.pmid
           ? deriveThumbnailCoverUrl('tencent', `https://y.gtimg.cn/music/photo_new/T002R800x800M000${song.album.pmid}.jpg`)
           : '',
        urlId: song.mid,
        lyricId: song.mid,
        picId: song.album?.mid || '',
        // VIP 判断: pay_month=1 月度会员, pay_down=1 付费下载, msgpay>0 VIP 标志
        vip: song.pay?.pay_month === 1 || song.pay?.pay_down === 1 || (song.action?.msgpay ?? 0) > 0,
      }))

      // Register into track registry and search index
      this.registerTracks(tracks)

      logger.info(`Search "${keyword}" on tencent: ${tracks.length} results`)
      return tracks
    } catch (error) {
      if (!(error instanceof SearchError)) logger.error('Tencent search failed:', error)
      throw error instanceof SearchError ? error : new SearchError()
    }
  }

  /** Search for albums (playlist-shaped entries). The searching itself lives in `catalogSearch`. */
  searchAlbum(source: MusicSource, keyword: string, limit = 20, page = 1): Promise<Playlist[]> {
    return searchAlbums(source, keyword, limit, page)
  }

  /** Search for playlists. The searching itself lives in `catalogSearch`. */
  searchPlaylist(source: MusicSource, keyword: string, limit = 20, page = 1): Promise<Playlist[]> {
    return searchPlaylists(source, keyword, limit, page)
  }

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
      // QQ 音乐使用新版搜索 API (Meting API 已失效)
      if (source === 'tencent') {
        const tracks = await this.searchTencent(keyword, limit, page)
        // Update search index (cacheKey already defined above)
        this.searchIndex.set(cacheKey, {
          source,
          ids: tracks.map((t) => t.sourceId),
        })
        return tracks
      }

      // Fresh instance without format — gets raw API response with all fields
      const meting = new Meting(source)
      const raw = await withTimeout(meting.search(keyword, { limit, page }))
      if (raw === null) {
        logger.warn(`Search timeout for ${source}: "${keyword}"`)
        throw new SearchError()
      }

      let rawData: MetingJson
      try {
        rawData = JSON.parse(raw) as MetingJson
      } catch (parseError) {
        logger.error(`Search JSON parse failed for ${source}`)
        logger.error(`Parse error:`, parseError)
        logger.error(`Full raw response:`, raw)
        logger.error(`Raw response type:`, typeof raw)
        logger.error(`Raw response length:`, raw?.length)
        throw new SearchError()
      }

      const songs = navigatePath(rawData, SEARCH_PATHS[source])
      if (!Array.isArray(songs) || songs.length === 0) return []

      const tracks = songs.map((song: MetingJson) => rawToTrack(song, source))

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
      if (err instanceof SearchError) throw err
      logger.error(`Search failed for ${source}:`, err)
      throw new SearchError()
    }
  }

  // ---------------------------------------------------------------------------
  // Public API — Stream URL, Lyric, Cover (unchanged from original)
  // ---------------------------------------------------------------------------

  /**
   * Get stream URL for a track. Optionally inject a cookie for VIP access.
   * Authenticated NetEase playback uses the normal SDK endpoint; other platforms
   * get a fresh Meting instance. Account-specific URLs are never cached.
   */
  async getStreamUrl(source: MusicSource, urlId: string, bitrate = 320, cookie?: string): Promise<string | null> {
    if (source === 'netease' && cookie) return getNeteasePlaybackUrl(urlId, bitrate, cookie)

    // Skip cache when cookie is provided (VIP URLs are user-specific)
    if (!cookie) {
      const cacheKey = `${source}:${urlId}:${bitrate}`
      const cached = this.streamUrlCache.get(cacheKey)
      if (cached) {
        if (isStreamUrlExpired(source, cached)) {
          this.streamUrlCache.delete(cacheKey)
        } else {
          logger.info(`Stream URL cache hit: ${source}/${urlId}`)
          return cached
        }
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

      const now = Date.now()
      if (url && isStreamUrlExpired(source, url, now)) return null

      // Only cache non-cookie & successful results (null = transient failure, retry next time)
      if (!cookie && url) {
        this.streamUrlCache.set(`${source}:${urlId}:${bitrate}`, url, { ttl: getStreamUrlCacheTtl(source, url, now) })
      }

      return url
    } catch (err) {
      logger.error(`Get URL failed for ${source}:`, err)
      return null
    }
  }

  /** A song's lyric (empty when the platform has none or does not answer). Reading it lives in `lyricFetch`. */
  async getLyric(source: MusicSource, lyricId: string): Promise<LyricResult> {
    const cacheKey = `${source}:${lyricId}`
    const cached = this.lyricCache.get(cacheKey)
    if (cached) {
      logger.info(`Lyric cache hit: ${source}/${lyricId}`)
      return cached
    }

    try {
      const result = await fetchLyric(source, lyricId, () => this.getInstance(source))
      // Only a lyric that was really read is remembered: an empty one may just be a bad moment upstream.
      if (!result) return { ...EMPTY_LYRIC }
      this.lyricCache.set(cacheKey, result)
      return result
    } catch (err) {
      logger.error(`Get lyric failed for ${source}:`, err)
      return { ...EMPTY_LYRIC }
    }
  }

  async getCover(source: MusicSource, picId: string, size?: number): Promise<string> {
    const requestSize = getCoverRequestSize(source, size)
    const cacheKey = `${source}:${picId}:${requestSize}`
    const cached = this.coverCache.get(cacheKey)
    if (cached !== undefined) {
      return cached
    }

    try {
      const meting = this.getInstance(source)
      const raw = await withTimeout(meting.pic(picId, requestSize))
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
      const rawUrl = (data.url as string) || ''
      const url =
        source === 'netease'
          ? normalizeNeteaseCoverUrl(rawUrl)
          : source === 'kugou'
            ? normalizeKugouTemplateCoverUrl(rawUrl)
            : rawUrl

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
    type: 'playlist' | 'album' = 'playlist'
  ): Promise<{ ids: string[]; total: number }> {
    const cacheKey = playlistCacheKey(source, playlistId, type, cookie)

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
      if (type === 'album') {
        return this.fetchNeteaseAlbum(playlistId, cacheKey)
      }
      return this.fetchNeteasePlaylist(playlistId, cacheKey, playlistTotal, cookie)
    }

    // Kugou: try native API (works with global_collection_id from user playlists)
    // Falls back to Meting for public playlists / special IDs
    if (source === 'kugou') {
      if (type === 'album') {
        return this.fetchMetingPlaylist(source, playlistId, cacheKey, type)
      }
      const result = await this.fetchKugouPlaylist(playlistId, cacheKey, cookie)
      if (result.total > 0) return result
      logger.info(`Kugou native API returned empty for ${playlistId}, falling back to Meting`)
    }

    // Tencent: use new native API (supports fav & custom lists)
    if (source === 'tencent') {
      if (type === 'album') {
        return this.fetchMetingPlaylist(source, playlistId, cacheKey, type)
      }
      const result = await this.fetchTencentPlaylist(playlistId, cacheKey, cookie)
      if (result.total > 0) return result
      logger.info(`Tencent native API returned empty for ${playlistId}, falling back to Meting`)
    }

    // Fallback: use Meting raw mode
    return this.fetchMetingPlaylist(source, playlistId, cacheKey, type)
  }

  /**
   * Fetch full Netease playlist via ncmApi.playlist_track_all.
   * No 1000-track limit; returns full song data including duration/album/artist.
   */
  
  /** Fetch Netease album using ncmApi.album */
  private async fetchNeteaseAlbum(
    albumId: string,
    cacheKey: string,
  ): Promise<{ ids: string[]; total: number }> {
    try {
      const res = await withTimeout(ncmApi.album({ id: albumId, timestamp: Date.now() }), 30_000)
      if (res === null) {
        logger.warn(`Netease album timeout: ${albumId}`)
        return { ids: [], total: 0 }
      }

      const songs = res?.body?.songs
      if (!Array.isArray(songs) || songs.length === 0) {
        return { ids: [], total: 0 }
      }

      const allTracks = songs.map((song: any) => rawToTrack(song, 'netease'))
      
      for (const t of allTracks) this.enrichFromRegistry(t)
      this.registerTracks(allTracks)

      const ids = allTracks.map((t) => t.sourceId)
      this.playlistIndex.set(cacheKey, { source: 'netease', ids })

      logger.info(`Netease album ${albumId}: ${ids.length} tracks`)
      return { ids, total: ids.length }
    } catch (err) {
      logger.error(`Netease album failed: ${albumId}`, err)
      return { ids: [], total: 0 }
    }
  }

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
        const res = await withTimeout(ncmApi.playlist_track_all({ ...baseParams, limit: CHUNK_SIZE, offset }), 60_000)

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

        const chunk = songs.map((song: Record<string, unknown>) => rawToTrack(song, 'netease'))
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
          const track = kugouSongToTrack(song)
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

  /**
   * Fetch Tencent playlist via native API.
   * Leverages the new encrypted-uin based getPlaylistTracks implementation.
   */
  private async fetchTencentPlaylist(
    playlistId: string,
    cacheKey: string,
    cookie?: string | null,
  ): Promise<{ ids: string[]; total: number }> {
    try {
      const PAGE_SIZE = 100
      const allTracks: Track[] = []
      let page = 1
      let totalFromApi = 0

      while (true) {
        const { songs, total } = await tencentAuth.getPlaylistTracks(playlistId, page, PAGE_SIZE, cookie)
        if (page === 1) totalFromApi = total

        if (songs.length === 0) break

        for (const song of songs) {
          const track = rawToTrack(song, 'tencent')
          if (track) allTracks.push(track)
        }

        if (allTracks.length >= totalFromApi || songs.length < PAGE_SIZE) break
        page++
      }

      if (allTracks.length === 0) return { ids: [], total: 0 }

      for (const t of allTracks) this.enrichFromRegistry(t)
      this.registerTracks(allTracks)

      const ids = allTracks.map((t) => t.sourceId)
      this.playlistIndex.set(cacheKey, { source: 'tencent', ids })

      logger.info(`Tencent playlist ${playlistId}: ${ids.length} tracks (via native API, ${page} pages)`)
      return { ids, total: ids.length }
    } catch (err) {
      logger.error(`Tencent playlist fetch failed: ${playlistId}`, err)
      return { ids: [], total: 0 }
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
    type: 'playlist' | 'album' = 'playlist'
  ): Promise<{ ids: string[]; total: number }> {
    try {
      const meting = new Meting(source)
      const raw = await withTimeout(type === 'album' ? meting.album(playlistId) : meting.playlist(playlistId), 30_000)
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

      // For Tencent album, the path is data.getSongInfo, for Kugou it's data.info
      let path = PLAYLIST_PATHS[source]
      if (type === 'album') {
        if (source === 'tencent') path = 'data.getSongInfo'
        if (source === 'kugou') path = 'data.info'
      }
      const songs = navigatePath(rawData, path)
      if (!Array.isArray(songs) || songs.length === 0) return { ids: [], total: 0 }

      const tracks = songs.map((song: MetingJson) => rawToTrack(song, source))
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
    type: 'playlist' | 'album' = 'playlist'
  ): Promise<{ tracks: Track[]; total: number; hasMore: boolean }> {
    const { ids, total } = await this.fetchFullPlaylist(source, playlistId, playlistTotal, cookie, type)
    if (total === 0) return { tracks: [], total: 0, hasMore: false }

    const pageIds = ids.slice(offset, offset + limit)

    // Hydrate page from registry
    let tracks = this.hydrateFromRegistry(source, pageIds)
    if (!tracks) {
      // Registry eviction between fetchFullPlaylist and hydrate (very rare).
      // Clear index and retry once.
      this.playlistIndex.delete(playlistCacheKey(source, playlistId, type, cookie))
      logger.warn(`Playlist page hydration failed, retrying: ${source}/${playlistId}`)
      const retry = await this.fetchFullPlaylist(source, playlistId, playlistTotal, cookie, type)
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

    for (const track of tracks) {
      if (track.cover) track.thumbnailCover = deriveThumbnailCoverUrl(source, track.cover)
    }

    // Write newly resolved covers back to registry for cross-page / cross-context reuse
    this.registerTracks(tracks)

    return { tracks, total, hasMore: offset + limit < total }
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

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
           const requestSize = getCoverRequestSize(source)
           const cacheKey = `${source}:${track.picId!}:${requestSize}`
          const cached = this.coverCache.get(cacheKey)
          if (cached !== undefined) {
            track.cover = cached
            return
          }

          try {
            // Fresh instance per call to avoid shared state race conditions
            const instance = new Meting(source)
             const raw = await instance.pic(track.picId!, requestSize)
            const data = JSON.parse(raw)
             if (typeof data.url === 'string' && data.url) {
               const coverUrl =
                 source === 'netease'
                   ? normalizeNeteaseCoverUrl(data.url)
                   : source === 'kugou'
                     ? normalizeKugouTemplateCoverUrl(data.url)
                     : data.url
               track.cover = coverUrl
               this.coverCache.set(cacheKey, coverUrl)
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
