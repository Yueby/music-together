import { createHash } from 'node:crypto'
import {
  DISCOVER_SOURCES,
  type Artist,
  type DiscoverHome,
  type DiscoverHomeBlock,
  type MusicSource,
  type Playlist,
  type Track,
} from '@music-together/shared'
import ncmApi from '@neteasecloudmusicapienhanced/api'
import { logger } from '../utils/logger.js'
import {
  CatalogError,
  isRecord,
  neteaseAlbum,
  neteaseArtist,
  neteaseCover,
  numericId,
  sharedCache,
  text,
  count,
  withDeadline,
  type CatalogErrorKind,
  type Raw,
} from './catalogUtils.js'
import { GRID_COVER_SIZE } from './gridCovers.js'
import { musicProvider } from './musicProvider.js'

/** What the account page's discovery blocks show: a dozen entries each, like a streaming app's home page. */
const HOME_LIMIT = 12
/** Recommendations are fetched a little wider than they are shown: the radar lists among them are dropped. */
const RECOMMEND_FETCH_LIMIT = 20
const HOME_TTL_MS = 30 * 60_000
const CHART_TTL_MS = 60 * 60_000

/**
 * The radar playlists have fixed ids (private, member, time, fan, treasure, new-song and mystery radar). Their content
 * is personal: it is read through the normal playlist endpoints with the caller's login, not here.
 */
export const RADAR_PLAYLIST_IDS = [
  '3136952023',
  '8402996200',
  '5320167908',
  '5327906368',
  '5362359247',
  '5300458264',
  '5341776086',
] as const

const REQUEST_TIMEOUT_MS = 10_000
const RADAR_TTL_MS = 60 * 60_000
/** A radar answer with a list missing (one failed or was unusable) is kept only briefly, so the gap heals soon. */
const RADAR_PARTIAL_TTL_MS = 2 * 60_000
const DAILY_TTL_MS = 30 * 60_000

export type DiscoverErrorCode = 'DISCOVER_UNSUPPORTED' | 'DISCOVER_LOGIN_REQUIRED' | 'DISCOVER_UPSTREAM'

const DISCOVER_ERROR_KINDS: Record<DiscoverErrorCode, CatalogErrorKind> = {
  DISCOVER_UNSUPPORTED: 'unsupported',
  DISCOVER_LOGIN_REQUIRED: 'login-required',
  DISCOVER_UPSTREAM: 'upstream',
}

export class DiscoverError extends CatalogError {
  declare readonly code: DiscoverErrorCode
  constructor(code: DiscoverErrorCode, status: 400 | 401 | 503) {
    super(DISCOVER_ERROR_KINDS[code], code, status)
    this.name = 'DiscoverError'
  }
}

export interface DiscoverNcm {
  playlist_detail(query: Record<string, unknown>): Promise<{ body?: Record<string, unknown> }>
  recommend_songs(query: Record<string, unknown>): Promise<{ body?: Record<string, unknown> }>
  recommend_resource(query: Record<string, unknown>): Promise<{ body?: Record<string, unknown> }>
  personalized(query: Record<string, unknown>): Promise<{ body?: Record<string, unknown> }>
  top_artists(query: Record<string, unknown>): Promise<{ body?: Record<string, unknown> }>
  album_new(query: Record<string, unknown>): Promise<{ body?: Record<string, unknown> }>
}

interface DiscoverDependencies {
  ncm: DiscoverNcm
  ingestSongs: (songs: unknown) => Track[]
  timeoutMs: number
}

/** Which account a cached answer belongs to, without keeping the cookie itself. */
function accountKey(cookie: string): string {
  return createHash('sha256').update(cookie).digest('hex').slice(0, 16)
}

function toRadar(raw: Raw): Playlist | null {
  const id = numericId(raw.id)
  const name = text(raw.name)
  if (!id || !name) return null
  return {
    id,
    name,
    ...neteaseCover(raw, GRID_COVER_SIZE),
    trackCount: count(raw.trackCount) ?? 0,
    source: 'netease',
    creator: isRecord(raw.creator) ? text(raw.creator.nickname) : '',
    description: text(raw.description) || undefined,
  }
}

/** A recommended playlist (daily personal list or generic "personalized" one); the editor's blurb becomes the description. */
function toRecommended(raw: Raw): Playlist | null {
  const id = numericId(raw.id)
  const name = text(raw.name)
  // The radar lists have their own block (and are personal: they must not show up as an ordinary recommendation).
  // Recognised by id: a title can be renamed or localised, and an ordinary playlist may well have "雷达" in its name.
  if (!id || !name || (RADAR_PLAYLIST_IDS as readonly string[]).includes(id)) return null
  return {
    id,
    name,
    ...neteaseCover(raw, GRID_COVER_SIZE),
    trackCount: count(raw.trackCount) ?? 0,
    source: 'netease',
    creator: isRecord(raw.creator) ? text(raw.creator.nickname) : '',
    description: text(raw.copywriter) || undefined,
  }
}

function pick<T>(raw: unknown, map: (item: Raw) => T | null): T[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    const mapped = isRecord(item) ? map(item) : null
    return mapped ? [mapped] : []
  })
}

export function createDiscoverService(overrides: Partial<DiscoverDependencies> = {}) {
  const deps: DiscoverDependencies = {
    ncm: ncmApi as unknown as DiscoverNcm,
    ingestSongs: (songs) => musicProvider.ingestNeteaseSongs(songs),
    timeoutMs: REQUEST_TIMEOUT_MS,
    ...overrides,
  }
  const cachedRadar = sharedCache<Playlist[]>(4, RADAR_TTL_MS, (lists) =>
    lists.length < RADAR_PLAYLIST_IDS.length ? RADAR_PARTIAL_TTL_MS : undefined,
  )
  const cachedDaily = sharedCache<Track[]>(200, DAILY_TTL_MS)
  const cachedPlaylists = sharedCache<Playlist[]>(200, HOME_TTL_MS)
  const cachedArtists = sharedCache<Artist[]>(2, CHART_TTL_MS)
  const cachedAlbums = sharedCache<Playlist[]>(2, CHART_TTL_MS)

  function requireNetease(source: MusicSource): void {
    if (!DISCOVER_SOURCES.includes(source)) throw new DiscoverError('DISCOVER_UNSUPPORTED', 400)
  }

  /** A business `code` other than 200 (or a malformed body) is a failure even when HTTP succeeded. */
  async function call(label: string, work: () => Promise<{ body?: Record<string, unknown> }>): Promise<Raw> {
    try {
      const response = await withDeadline(work(), deps.timeoutMs, () => new DiscoverError('DISCOVER_UPSTREAM', 503))
      const body = response?.body
      if (!isRecord(body)) throw new DiscoverError('DISCOVER_UPSTREAM', 503)
      if (body.code !== undefined && body.code !== 200) {
        logger.warn(`NetEase ${label} returned business code`, { code: body.code })
        // 301 / 401: the account is not (or no longer) logged in.
        throw body.code === 301 || body.code === 401
          ? new DiscoverError('DISCOVER_LOGIN_REQUIRED', 401)
          : new DiscoverError('DISCOVER_UPSTREAM', 503)
      }
      return body
    } catch (error) {
      if (error instanceof DiscoverError) throw error
      logger.warn(`NetEase ${label} failed`)
      throw new DiscoverError('DISCOVER_UPSTREAM', 503)
    }
  }

  return {
    /** The radar playlists (names, artwork, counts). Anonymous and shared by everyone; one failing list is skipped. */
    async getRadar(source: MusicSource): Promise<Playlist[]> {
      requireNetease(source)
      return cachedRadar('radar', async () => {
        const settled = await Promise.allSettled(
          RADAR_PLAYLIST_IDS.map((id) =>
            call('playlist_detail(radar)', () => deps.ncm.playlist_detail({ id, timestamp: Date.now() })),
          ),
        )
        const lists = settled.flatMap((result) => {
          if (result.status !== 'fulfilled' || !isRecord(result.value.playlist)) return []
          const list = toRadar(result.value.playlist)
          return list ? [list] : []
        })
        if (lists.length === 0) throw new DiscoverError('DISCOVER_UPSTREAM', 503)
        return lists
      })
    },

    /**
     * The home blocks: recommended playlists (personal for the account behind `cookie`, generic without one), hot artists
     * and new albums. The blocks fail independently (an empty block, listed in `failed`, rather than no page); only when
     * all of them fail is the whole answer an error.
     */
    async getHome(source: MusicSource, cookie: string | null): Promise<DiscoverHome> {
      requireNetease(source)

      const personal = async (login: string): Promise<Playlist[]> => {
        const body = await call('recommend_resource', () =>
          deps.ncm.recommend_resource({ cookie: login, timestamp: Date.now() }),
        )
        return pick(body.recommend, toRecommended).slice(0, HOME_LIMIT)
      }
      const generic = async (): Promise<Playlist[]> => {
        const body = await call('personalized', () => deps.ncm.personalized({ limit: RECOMMEND_FETCH_LIMIT }))
        return pick(body.result, toRecommended).slice(0, HOME_LIMIT)
      }
      const playlists = cachedPlaylists(cookie ? accountKey(cookie) : 'anonymous', async () => {
        if (!cookie) return generic()
        try {
          return await personal(cookie)
        } catch (error) {
          // A login that no longer works still gets the generic recommendations rather than an error.
          if (error instanceof DiscoverError && error.code === 'DISCOVER_LOGIN_REQUIRED') return generic()
          throw error
        }
      })
      const artists = cachedArtists('top', async () => {
        const body = await call('top_artists', () => deps.ncm.top_artists({ limit: HOME_LIMIT }))
        return pick(body.artists, (raw) => neteaseArtist(raw, { thumbnailSize: GRID_COVER_SIZE }))
      })
      const albums = cachedAlbums('new', async () => {
        const body = await call('album_new', () => deps.ncm.album_new({ limit: HOME_LIMIT }))
        return pick(body.albums, (raw) => neteaseAlbum(raw, GRID_COVER_SIZE))
      })

      const settled = await Promise.allSettled([playlists, artists, albums])
      const [p, a, n] = settled
      if (settled.every((result) => result.status === 'rejected')) throw new DiscoverError('DISCOVER_UPSTREAM', 503)
      const failed: DiscoverHomeBlock[] = []
      if (p.status === 'rejected') failed.push('playlists')
      if (a.status === 'rejected') failed.push('artists')
      if (n.status === 'rejected') failed.push('albums')
      return {
        playlists: p.status === 'fulfilled' ? p.value : [],
        artists: a.status === 'fulfilled' ? a.value : [],
        albums: n.status === 'fulfilled' ? n.value : [],
        failed,
      }
    },

    /** Today's recommended songs for the account behind `cookie` (a login is required). */
    async getDaily(source: MusicSource, cookie: string | null): Promise<Track[]> {
      requireNetease(source)
      if (!cookie) throw new DiscoverError('DISCOVER_LOGIN_REQUIRED', 401)
      return cachedDaily(accountKey(cookie), async () => {
        const body = await call('recommend_songs', () => deps.ncm.recommend_songs({ cookie, timestamp: Date.now() }))
        const data = isRecord(body.data) ? body.data : {}
        return deps.ingestSongs(data.dailySongs)
      })
    },
  }
}

export const discoverService = createDiscoverService()
