import { createHash } from 'node:crypto'
import Meting from '@meting/core'
import { UNKNOWN_ARTIST } from '@music-together/shared'
import type { MusicSource, Playlist, Track } from '@music-together/shared'
import { LRUCache } from 'lru-cache'
import { nanoid } from 'nanoid'
import pLimit from 'p-limit'
import { fetchLyric, type LyricResult } from './lyricFetch.js'
import { fetchPlaylistTracks, type PlaylistKind } from './playlistFetchers.js'
import * as tencentAuth from './tencentAuthService.js'
import { toMetingKugouCookie } from '../utils/cookieUtils.js'
import { logger } from '../utils/logger.js'
import { withTimeoutOrNull } from '../utils/withTimeout.js'
import { searchAlbums, searchPlaylists } from './catalogSearch.js'
import { SearchError } from './catalogUtils.js'
import { navigatePath, rawToTrack, rawToTrackOrNull } from './trackMapping.js'
import { deriveThumbnailCoverUrl, normalizeCoverUrl, normalizeNeteaseCoverUrl } from './coverUrls.js'
import { getStreamUrlCacheTtl, isStreamUrlExpired } from './streamUrlLifetime.js'
import { getNeteasePlaybackUrl } from './neteasePlayback.js'

// ---------------------------------------------------------------------------
// Meting instance type (library has no TS declarations)
// ---------------------------------------------------------------------------
type MetingInstance = InstanceType<typeof Meting>

/** Parsed JSON from Meting API responses */
type MetingJson = Record<string, unknown>

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

/** Singer names of a QQ search hit; "nobody credited" (no singers, or none with a name) is the shared placeholder. */
function tencentArtistNames(song: TencentSearchSong): string[] {
  const names = (song.singer ?? []).map((s) => s?.name).filter((name): name is string => !!name)
  return names.length > 0 ? names : [UNKNOWN_ARTIST]
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

// ---------------------------------------------------------------------------
// Cache TTL constants
// ---------------------------------------------------------------------------
const HOUR = 60 * 60 * 1000
const MINUTE = 60 * 1000

/** Time boxes of `batchResolveCover` (search and playlist pages wait for it): per cover request, and for the batch. */
const COVER_PIC_TIMEOUT_MS = 4_000
const COVER_BATCH_TIMEOUT_MS = 10_000
const KUGOU_PLAYLIST_COVER_LIMIT = 15
const KUGOU_PLAYLIST_COVER_BUDGET_MS = 1_200

const EMPTY_LYRIC: LyricResult = { lyric: '', tlyric: '', romalrc: '', yrc: '', cacheable: false }

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
type PlaylistPage = { tracks: Track[]; total: number; hasMore: boolean }
type PlaylistIndex = { ids: string[]; total: number }
type PlaylistLoader = {
  ids: string[]
  tracks: Track[]
  knownTotal: number
  finished: boolean
  complete: boolean
  waiters: Set<() => void>
  completion: Promise<PlaylistIndex>
}

class MusicProvider {
  // ---------------------------------------------------------------------------
  // 3-Layer Cache Architecture
  // ---------------------------------------------------------------------------

  // Layer 1: Track Registry — single source of truth for all track metadata.
  // Every track that passes through the system (search, playlist) gets registered
  // here. Cross-context enrichment: search provides duration + cover, playlist
  // provides additional tracks. Merge strategy keeps the richest data.
  private trackRegistry = new LRUCache<string, TrackMeta>({
    max: 50_000,
    ttl: 2 * HOUR,
  })

  // Layer 2: Reference Indexes — store only sourceId arrays, NOT full Track objects.
  // Memory-efficient: a 2000-track playlist costs ~40KB (IDs) instead of ~1MB (Track[]).
  private searchIndex = new LRUCache<string, { source: MusicSource; ids: string[] }>({
    max: 200,
    ttl: 10 * MINUTE,
  })
  private playlistIndex = new LRUCache<string, PlaylistIndex>({
    max: 50,
    ttl: 30 * MINUTE,
  })
  private playlistPageCache = new LRUCache<string, PlaylistPage>({ max: 200, ttl: 5 * MINUTE })

  // Layer 3: Resource Caches — scalar values for stream URLs, covers, lyrics.
  private streamUrlCache = new LRUCache<string, string>({ max: 500, ttl: 1 * HOUR })
  private coverCache = new LRUCache<string, string>({ max: 1000, ttl: 24 * HOUR })
  private lyricCache = new LRUCache<string, LyricResult>({
    max: 500,
    ttl: 24 * HOUR,
  })

  private playlistInflight = new Map<string, PlaylistLoader>()
  private kugouPlaylistCoverLimit = pLimit(3)
  private kugouPlaylistCovers = new Map<string, Promise<string>>()

  /**
   * A fresh formatted instance per operation. Meting keeps per-request state on the instance (`temp.br` is read
   * after the HTTP round trip by the QQ/Kugou decoders, Kugou's `pic()` toggles `isFormat`), so sharing one across
   * concurrent requests lets them overwrite each other (a 320k request answered with a 128k link, cached as 320k).
   */
  private getInstance(source: MusicSource): MetingInstance {
    const m = new Meting(source)
    m.format(true)
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

  /**
   * Tracks found by a direct lookup (by id), registered like search results so queueing them later is enriched the same
   * way: known covers kept, missing ones resolved. All tracks are from one platform.
   */
  async ingest(tracks: Track[]): Promise<Track[]> {
    if (tracks.length === 0) return tracks
    for (const track of tracks) this.enrichFromRegistry(track)
    await this.batchResolveCover(tracks, tracks[0].source)
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
      // A song without a `mid` could never be played (and would collide on one key): drop it, keep the rest.
      const playable = songList.filter((song) => typeof song?.mid === 'string' && song.mid !== '')
      const tracks: Track[] = playable.map((song) => ({
        id: nanoid(),
        source: 'tencent' as const,
        sourceId: song.mid,
        title: song.name || song.title || 'Unknown',
        artist: tencentArtistNames(song),
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
        // An empty list is not remembered: QQ's risk control sometimes answers one, and it must not turn the keyword
        // into "no results" for the whole index lifetime (the other platforms return early without caching too).
        if (tracks.length > 0) {
          this.searchIndex.set(cacheKey, {
            source,
            ids: tracks.map((t) => t.sourceId),
          })
        }
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

      // A NetEase business code other than 200 (rate limiting answers 405 / -460 ...) is a refusal, not "no hits".
      // Code 200 without `result` is the normal empty answer and still falls through to `[]` below.
      if (source === 'netease' && rawData.code !== undefined && rawData.code !== 200) {
        logger.warn(`Search for ${source} returned business code`, { code: rawData.code })
        throw new SearchError()
      }

      // Kugou says the same with a non-zero `errcode` (album and playlist search already check it).
      if (source === 'kugou' && rawData.errcode !== undefined && rawData.errcode !== 0) {
        logger.warn(`Search for ${source} returned business code`, { errcode: rawData.errcode })
        throw new SearchError()
      }

      const songs = navigatePath(rawData, SEARCH_PATHS[source])
      if (!Array.isArray(songs) || songs.length === 0) return []

      // Entries without a usable id are dropped (they could never be played), without disturbing the others.
      const tracks = songs.flatMap((song: MetingJson) => {
        const track = rawToTrackOrNull(song, source)
        return track ? [track] : []
      })
      if (tracks.length === 0) return []

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

  invalidateStreamUrl(source: MusicSource, urlId: string): void {
    const prefix = `${source}:${urlId}:`
    for (const key of [...this.streamUrlCache.keys()]) {
      if (key.startsWith(prefix)) this.streamUrlCache.delete(key)
    }
  }

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
      if (source === 'netease') {
        meting = new Meting(source)
        meting.format(false)
      } else if (cookie) {
        // Fresh instance with cookie — don't pollute the shared one
        meting = new Meting(source)
        meting.format(true)
        // Kugou's login is stored as `token=..;userid=..`; Meting only signs in with `t=..;KugooID=..`
        meting.cookie(source === 'kugou' ? toMetingKugouCookie(cookie) : cookie)
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
      if (source === 'netease') {
        if (data?.code !== 200 || !Array.isArray(data.data)) return null
        const song = data.data.find((item) => item && String(item.id) === urlId)
          ?? (data.data.length === 1 ? data.data[0] : null)
        if (song?.code !== 200 || song.freeTrialInfo != null) return null
        data = song
      }

      // 强制 HTTPS，避免 HTTPS 页面加载 HTTP 音频触发 Mixed Content 警告
      const url = typeof data?.url === 'string' ? data.url.replace(/^http:\/\//, 'https://') : null
      if (!url?.startsWith('https://') || !URL.canParse(url)) return null

      const now = Date.now()
      if (isStreamUrlExpired(source, url, now)) return null

      // Only cache non-cookie & successful results (null = transient failure, retry next time)
      if (!cookie) {
        this.streamUrlCache.set(`${source}:${urlId}:${bitrate}`, url, { ttl: getStreamUrlCacheTtl(source, url, now) })
      }

      return url
    } catch {
      logger.error(`Get URL failed for ${source}`)
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
      const fetched = await fetchLyric(source, lyricId, () => this.getInstance(source))
      // Only a lyric that was really read is remembered: an empty one may just be a bad moment upstream, and a degraded
      // one (Kugou's plain LRC after its KRC lookup failed) is served but not kept, so the next play can do better.
      if (!fetched) return { ...EMPTY_LYRIC }
      if (fetched.cacheable) this.lyricCache.set(cacheKey, fetched)
      return fetched
    } catch (err) {
      logger.error(`Get lyric failed for ${source}:`, err)
      return { ...EMPTY_LYRIC }
    }
  }

  async getCover(source: MusicSource, picId: string, size?: number): Promise<string> {
    const requestSize = getCoverRequestSize(source, size)
    const cacheKey = `${source}:${picId}:${requestSize}`
    // Only non-empty addresses are cached (see below), so any hit is a usable one.
    const cached = this.coverCache.get(cacheKey)
    if (cached) {
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
      const url = normalizeCoverUrl(source, rawUrl)

      // An empty address may just be a bad moment upstream (Kugou answers `{url: ''}` per call): retry next time.
      if (url) this.coverCache.set(cacheKey, url)
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
   * Return all available track IDs once the shared playlist read finishes.
   */
  async fetchFullPlaylist(
    source: MusicSource,
    playlistId: string,
    cookie?: string | null,
    type: PlaylistKind = 'playlist',
  ): Promise<{ ids: string[]; total: number }> {
    const cacheKey = playlistCacheKey(source, playlistId, type, cookie)
    const { ids } = this.playlistIndex.get(cacheKey) ??
      (await this.getPlaylistLoader(cacheKey, source, playlistId, type, cookie).completion)
    return { ids, total: ids.length }
  }

  private getPlaylistLoader(
    cacheKey: string,
    source: MusicSource,
    playlistId: string,
    type: PlaylistKind,
    cookie?: string | null,
  ): PlaylistLoader {
    const running = this.playlistInflight.get(cacheKey)
    if (running) return running

    const loader: PlaylistLoader = {
      ids: [],
      tracks: [],
      knownTotal: 0,
      finished: false,
      complete: false,
      waiters: new Set(),
      completion: Promise.resolve().then(() => load()),
    }
    const notify = () => {
      for (const wake of loader.waiters) wake()
      loader.waiters.clear()
    }
    const append = (batch: Track[], knownTotal = 0) => {
      for (const track of batch) this.enrichFromRegistry(track)
      this.registerTracks(batch)
      loader.tracks.push(...batch)
      for (const track of batch) loader.ids.push(track.sourceId)
      loader.knownTotal = Math.max(loader.knownTotal, knownTotal)
      notify()
    }

    const load = async () => {
      try {
        const { tracks, complete } = await fetchPlaylistTracks(source, playlistId, type, cookie, append)
        // Also support fetchers that only supply the final result.
        append(tracks.slice(loader.ids.length))
        const result = {
          ids: loader.ids,
          total: complete ? loader.ids.length : Math.max(loader.knownTotal, loader.ids.length),
        }
        loader.complete = complete && result.ids.length > 0
        if (loader.complete) {
          loader.knownTotal = loader.ids.length
          this.playlistIndex.set(cacheKey, result)
        } else if (!complete) {
          logger.warn(`Playlist ${source}/${playlistId} is incomplete (${result.ids.length} tracks)`)
        }
        return result
      } finally {
        loader.finished = true
        this.playlistInflight.delete(cacheKey)
        notify()
      }
    }

    this.playlistInflight.set(cacheKey, loader)
    // A page may have returned before an unexpected error in the background read. Full-list callers still see it.
    void loader.completion.catch(() => undefined)
    return loader
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
    // The caller's idea of the size (the `total` query) is accepted for the sake of the request contract but not used:
    // the list is read to its real end, and the result is shared between everybody who asks for it.
    _playlistTotal?: number,
    cookie?: string | null,
    type: PlaylistKind = 'playlist',
  ): Promise<PlaylistPage> {
    const cacheKey = playlistCacheKey(source, playlistId, type, cookie)
    const pageKey = cookie ? undefined : `${cacheKey}:${offset}:${limit}`
    const cached = pageKey ? this.playlistPageCache.get(pageKey) : undefined
    if (cached) return { ...cached, tracks: cached.tracks.map((track) => ({ ...track, id: nanoid() })) }

    const end = offset + limit
    const indexed = this.playlistIndex.get(cacheKey)
    let tracks = indexed ? this.hydrateFromRegistry(source, indexed.ids.slice(offset, end)) : null
    let total = indexed?.total ?? 0
    let loader: PlaylistLoader | undefined
    if (!tracks) {
      if (indexed) this.playlistIndex.delete(cacheKey)
      loader = this.getPlaylistLoader(cacheKey, source, playlistId, type, cookie)
      while (loader.ids.length < end && !loader.finished) {
        const waiters = loader.waiters
        await new Promise<void>((wake) => waiters.add(wake))
      }
      if (loader.ids.length < end) await loader.completion
      total = Math.max(loader.knownTotal, loader.ids.length)
      tracks = this.hydrateFromRegistry(source, loader.ids.slice(offset, end)) ??
        loader.tracks.slice(offset, end).map((track) => ({ ...track, id: nanoid() }))
    }

    const warmCovers = source === 'kugou' ? await this.resolveKugouPlaylistCovers(tracks) : undefined
    if (source !== 'kugou') await this.batchResolveCover(tracks, source)

    for (const track of tracks) {
      if (track.cover) track.thumbnailCover = deriveThumbnailCoverUrl(source, track.cover)
    }

    // Write newly resolved covers back to registry for cross-page / cross-context reuse
    this.registerTracks(tracks)

    const page = { tracks, total, hasMore: end < total }
    if (pageKey && (loader ? loader.complete : indexed) && total > 0) {
      // A fallback load can learn the final total after this page took its snapshot.
      if (!loader || total === Math.max(loader.knownTotal, loader.ids.length)) {
        const snapshot = { ...page, tracks: tracks.map((track) => ({ ...track })) }
        this.playlistPageCache.set(pageKey, snapshot)
        if (warmCovers) {
          void warmCovers.done.then(() => {
            if (this.playlistPageCache.peek(pageKey) !== snapshot) return
            let changed = false
            const updated = snapshot.tracks.map((track) => {
              const cover = !track.cover && track.picId ? this.getCachedCover('kugou', track.picId) : undefined
              if (!cover) return track
              changed = true
              return { ...track, cover, thumbnailCover: deriveThumbnailCoverUrl('kugou', cover) }
            })
            if (changed) this.playlistPageCache.set(pageKey, { ...snapshot, tracks: updated })
          })
        }
      }
    }
    return page
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private getCachedCover(source: MusicSource, picId: string): string | undefined {
    return this.coverCache.get(`${source}:${picId}:${getCoverRequestSize(source)}`)
  }

  private async resolveTrackCover(source: MusicSource, picId: string): Promise<string> {
    const cached = this.getCachedCover(source, picId)
    if (cached) return cached

    try {
      const size = getCoverRequestSize(source)
      const raw = await withTimeoutOrNull(new Meting(source).pic(picId, size), COVER_PIC_TIMEOUT_MS)
      if (raw == null) return ''
      const { url } = JSON.parse(raw)
      if (typeof url !== 'string' || !url) return ''
      const cover = normalizeCoverUrl(source, url)
      this.coverCache.set(`${source}:${picId}:${size}`, cover)
      return cover
    } catch {
      return ''
    }
  }

  private warmKugouPlaylistCover(picId: string): Promise<string> {
    const running = this.kugouPlaylistCovers.get(picId)
    if (running) return running
    const lookup = this.kugouPlaylistCoverLimit(() => this.resolveTrackCover('kugou', picId))
      .finally(() => this.kugouPlaylistCovers.delete(picId))
    this.kugouPlaylistCovers.set(picId, lookup)
    return lookup
  }

  private async resolveKugouPlaylistCovers(tracks: Track[]): Promise<{ done: Promise<void> } | undefined> {
    const missing = tracks.filter((track) => {
      if (track.cover || !track.picId) return false
      track.cover = this.getCachedCover('kugou', track.picId) ?? ''
      return !track.cover
    })
    if (!missing.length) return

    const warm = (track: Track) => this.warmKugouPlaylistCover(track.picId!).then((cover) => {
      if (cover) this.registerTracks([{ ...track, cover }])
      return cover
    })
    let withinBudget = true
    const visible = missing.slice(0, KUGOU_PLAYLIST_COVER_LIMIT).map((track) => warm(track).then((cover) => {
      if (withinBudget && cover) track.cover = cover
    }))
    await withTimeoutOrNull(Promise.allSettled(visible), KUGOU_PLAYLIST_COVER_BUDGET_MS)
    withinBudget = false
    const rest = missing.slice(KUGOU_PLAYLIST_COVER_LIMIT).map(warm)
    return { done: Promise.allSettled([...visible, ...rest]).then(() => undefined) }
  }

  /**
   * Batch-resolve cover URLs for tracks that don't have one.
   * - netease/tencent: pic() is pure URL generation (instant, no API call)
   * - kugou: pic() makes an API call per track (slower)
   *
   * Each pic() call uses a fresh Meting instance to avoid race conditions.
   *
   * Search and playlist pages wait for this, so it is time-boxed: each pic() gets `COVER_PIC_TIMEOUT_MS` and the whole
   * batch `COVER_BATCH_TIMEOUT_MS` (Meting's own 20s x 3 retries would be far too long). What did not finish in time is
   * left without a cover (the frontend shows a placeholder), and a timeout or failure is never cached.
   */
  private async batchResolveCover(tracks: Track[], source: MusicSource): Promise<void> {
    const toResolve = tracks.filter((t) => !t.cover && t.picId)
    if (toResolve.length === 0) return

    // For platforms that need API calls, limit concurrency
    const needsApiCall = source === 'kugou'
    const limit = pLimit(needsApiCall ? 3 : toResolve.length)

    // Set once the batch deadline has passed: later work must neither start new calls nor touch the returned tracks.
    let expired = false

    const work = Promise.allSettled(
      toResolve.map((track) =>
        limit(async () => {
          if (expired) return
          const cover = await this.resolveTrackCover(source, track.picId!)
          if (!expired && cover) track.cover = cover
        }),
      ),
    )

    try {
      if ((await withTimeoutOrNull(work, COVER_BATCH_TIMEOUT_MS)) === null) {
        logger.warn(`Cover resolution for ${source} hit the batch deadline (${toResolve.length} tracks)`)
      }
    } finally {
      expired = true
    }
  }
}

export const musicProvider = new MusicProvider()
