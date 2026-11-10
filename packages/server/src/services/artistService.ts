import type { Artist, MusicSource, Playlist, Track } from '@music-together/shared'
import ncmApi from '@neteasecloudmusicapienhanced/api'
import { LRUCache } from 'lru-cache'
import { logger } from '../utils/logger.js'
import { deriveThumbnailCoverUrl, musicProvider, normalizeNeteaseCoverUrl } from './musicProvider.js'

/** Artist data comes from NetEase only; the other platforms have no comparable catalog endpoints wired up. */
export const ARTIST_SOURCES: readonly MusicSource[] = ['netease']

const REQUEST_TIMEOUT_MS = 10_000
const PROFILE_TTL_MS = 15 * 60_000
const PAGE_TTL_MS = 10 * 60_000
const SEARCH_TTL_MS = 5 * 60_000
const SONG_PAGE_DEFAULT = 50
const ALBUM_PAGE_DEFAULT = 30

export type ArtistErrorCode = 'ARTIST_UNSUPPORTED' | 'ARTIST_NOT_FOUND' | 'ARTIST_UPSTREAM'

/**
 * Upstream failures are reported as 503, never 502/504: Cloudflare replaces those origin statuses with its own
 * header-less error page, which the browser can then only report as a CORS failure.
 */
const UPSTREAM_STATUS = 503

/** Sanitized failure: the message never carries upstream bodies. */
export class ArtistError extends Error {
  constructor(
    readonly code: ArtistErrorCode,
    readonly status: number,
  ) {
    super(code)
    this.name = 'ArtistError'
  }
}

/** The slice of the NetEase SDK used here. Responses are loosely typed (the SDK ships no declarations). */
export interface ArtistNcm {
  cloudsearch(query: Record<string, unknown>): Promise<{ body?: Record<string, unknown> }>
  artists(query: Record<string, unknown>): Promise<{ body?: Record<string, unknown> }>
  artist_songs(query: Record<string, unknown>): Promise<{ body?: Record<string, unknown> }>
  artist_album(query: Record<string, unknown>): Promise<{ body?: Record<string, unknown> }>
}

interface ArtistDependencies {
  ncm: ArtistNcm
  ingestSongs: (songs: unknown) => Track[]
  timeoutMs: number
}

export interface ArtistPage<T> {
  items: T[]
  hasMore: boolean
  total?: number
}

export interface ArtistHome {
  artist: Artist
  songs: ArtistPage<Track>
  albums: ArtistPage<Playlist>
}

type Raw = Record<string, unknown>
const isRecord = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
const count = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)
const id = (value: unknown): string | null => {
  const raw = typeof value === 'number' || typeof value === 'string' ? String(value).trim() : ''
  return /^\d{1,20}$/.test(raw) ? raw : null
}

function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ArtistError('ARTIST_UPSTREAM', UPSTREAM_STATUS)), ms)
  })
  // The SDK promise cannot be cancelled; if the deadline wins its late failure must not become unhandled.
  work.catch(() => {})
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer))
}

function coverOf(raw: Raw): { cover: string; thumbnailCover?: string } {
  const cover = normalizeNeteaseCoverUrl(text(raw.picUrl) || text(raw.img1v1Url) || text(raw.cover))
  return cover ? { cover, thumbnailCover: deriveThumbnailCoverUrl('netease', cover) } : { cover: '' }
}

function toArtist(raw: Raw, withDescription: boolean): Artist | null {
  const artistId = id(raw.id)
  const name = text(raw.name)
  if (!artistId || !name) return null
  return {
    id: artistId,
    name,
    ...coverOf(raw),
    source: 'netease',
    albumCount: count(raw.albumSize),
    songCount: count(raw.musicSize),
    ...(withDescription && text(raw.briefDesc) ? { description: text(raw.briefDesc) } : {}),
  }
}

function toAlbum(raw: Raw): Playlist | null {
  const albumId = id(raw.id)
  const name = text(raw.name)
  if (!albumId || !name) return null
  const artist = isRecord(raw.artist) ? text(raw.artist.name) : ''
  return {
    id: albumId,
    name,
    ...coverOf(raw),
    trackCount: count(raw.size) ?? 0,
    source: 'netease',
    creator: artist,
  }
}

export function createArtistService(overrides: Partial<ArtistDependencies> = {}) {
  const deps: ArtistDependencies = {
    ncm: ncmApi as unknown as ArtistNcm,
    ingestSongs: (songs) => musicProvider.ingestNeteaseSongs(songs),
    timeoutMs: REQUEST_TIMEOUT_MS,
    ...overrides,
  }
  /**
   * TTL cache whose misses share one upstream call per key: a room opening the same artist page must not multiply
   * requests to the (rate-limited) NetEase endpoints. A failed load is not cached.
   */
  function sharedCache<T extends {}>(max: number, ttl: number) {
    const cache = new LRUCache<string, T>({ max, ttl })
    const inflight = new Map<string, Promise<T>>()
    return (key: string, load: () => Promise<T>): Promise<T> => {
      const hit = cache.get(key)
      if (hit) return Promise.resolve(hit)
      const running = inflight.get(key)
      if (running) return running
      const started = load()
        .then((value) => {
          cache.set(key, value)
          return value
        })
        .finally(() => inflight.delete(key))
      inflight.set(key, started)
      return started
    }
  }
  const cachedHome = sharedCache<ArtistHome>(100, PROFILE_TTL_MS)
  const cachedSongs = sharedCache<ArtistPage<Track>>(200, PAGE_TTL_MS)
  const cachedAlbums = sharedCache<ArtistPage<Playlist>>(200, PAGE_TTL_MS)
  const cachedSearch = sharedCache<Artist[]>(200, SEARCH_TTL_MS)

  function requireNetease(source: MusicSource): void {
    if (!ARTIST_SOURCES.includes(source)) throw new ArtistError('ARTIST_UNSUPPORTED', 400)
  }

  /** A business `code` other than 200 (or a malformed body) is a failure even when HTTP succeeded. */
  async function call(label: string, work: () => Promise<{ body?: Record<string, unknown> }>): Promise<Raw> {
    try {
      const response = await withDeadline(work(), deps.timeoutMs)
      const body = response?.body
      if (!isRecord(body)) throw new ArtistError('ARTIST_UPSTREAM', UPSTREAM_STATUS)
      if (body.code !== undefined && body.code !== 200) {
        logger.warn(`NetEase ${label} returned business code`, { code: body.code })
        throw body.code === 404
          ? new ArtistError('ARTIST_NOT_FOUND', 404)
          : new ArtistError('ARTIST_UPSTREAM', UPSTREAM_STATUS)
      }
      return body
    } catch (error) {
      if (error instanceof ArtistError) throw error
      logger.warn(`NetEase ${label} failed`)
      throw new ArtistError('ARTIST_UPSTREAM', UPSTREAM_STATUS)
    }
  }

  async function loadSongs(artistId: string, offset: number, limit: number): Promise<ArtistPage<Track>> {
    const body = await call('artist_songs', () =>
      deps.ncm.artist_songs({ id: artistId, offset, limit, order: 'hot', timestamp: Date.now() }),
    )
    const items = deps.ingestSongs(body.songs)
    return { items, hasMore: body.more === true, total: count(body.total) }
  }

  async function loadAlbums(artistId: string, offset: number, limit: number): Promise<ArtistPage<Playlist>> {
    const body = await call('artist_album', () => deps.ncm.artist_album({ id: artistId, offset, limit, timestamp: Date.now() }))
    const raw = Array.isArray(body.hotAlbums) ? body.hotAlbums : []
    const items = raw.map((album) => (isRecord(album) ? toAlbum(album) : null)).filter((album): album is Playlist => !!album)
    return { items, hasMore: body.more === true }
  }

  return {
    async search(source: MusicSource, keyword: string, limit: number, page: number): Promise<Artist[]> {
      if (!ARTIST_SOURCES.includes(source)) return []
      return cachedSearch(`${keyword}:${limit}:${page}`, async () => {
        const body = await call('cloudsearch(artist)', () =>
          deps.ncm.cloudsearch({ keywords: keyword, type: 100, limit, offset: (page - 1) * limit }),
        )
        const result = isRecord(body.result) ? body.result : {}
        const raw = Array.isArray(result.artists) ? result.artists : []
        return raw.map((artist) => (isRecord(artist) ? toArtist(artist, false) : null)).filter((artist): artist is Artist => !!artist)
      })
    },

    /** Profile, the first page of songs (hottest first) and the first page of albums, fetched in parallel. */
    async getArtist(source: MusicSource, artistId: string): Promise<ArtistHome> {
      requireNetease(source)
      return cachedHome(artistId, async () => {
        const [profile, songs, albums] = await Promise.all([
          call('artists', () => deps.ncm.artists({ id: artistId, timestamp: Date.now() })),
          loadSongs(artistId, 0, SONG_PAGE_DEFAULT),
          loadAlbums(artistId, 0, ALBUM_PAGE_DEFAULT),
        ])
        const artist = isRecord(profile.artist) ? toArtist(profile.artist, true) : null
        if (!artist) throw new ArtistError('ARTIST_NOT_FOUND', 404)
        return { artist, songs, albums }
      })
    },

    async getSongs(source: MusicSource, artistId: string, offset: number, limit: number): Promise<ArtistPage<Track>> {
      requireNetease(source)
      return cachedSongs(`${artistId}:${offset}:${limit}`, () => loadSongs(artistId, offset, limit))
    },

    async getAlbums(source: MusicSource, artistId: string, offset: number, limit: number): Promise<ArtistPage<Playlist>> {
      requireNetease(source)
      return cachedAlbums(`${artistId}:${offset}:${limit}`, () => loadAlbums(artistId, offset, limit))
    },
  }
}

export const artistService = createArtistService()
