import Meting from '@meting/core'
import ncmApi from '@neteasecloudmusicapienhanced/api'
import type { MusicSource, Track } from '@music-together/shared'
import { logger } from '../utils/logger.js'
import { withTimeoutOrNull } from '../utils/withTimeout.js'
import * as kugouAuth from './kugouAuthService.js'
import * as tencentAuth from './tencentAuthService.js'
import { kugouSongToTrack, navigatePath, rawToTrackOrNull } from './trackMapping.js'

type NeteaseRequestOptions = { timestamp: number; cookie?: string }
const neteasePlaylistApi = ncmApi as typeof ncmApi & {
  playlist_detail(params: { id: string } & NeteaseRequestOptions): Promise<{
    body: { code: number; playlist?: { tracks?: Record<string, unknown>[]; trackIds?: { id: number | string }[] } }
  }>
  song_detail(params: { ids: string } & NeteaseRequestOptions): Promise<{
    body: { code: number; songs?: Record<string, unknown>[] }
  }>
}

/**
 * Where each platform's whole playlist or album comes from. Every fetcher answers the tracks in list order, or an empty
 * list when there is nothing, the request timed out or failed (logged). Pure fetching: no registry, no cache;
 * `MusicProvider` ingests what comes back.
 *
 * A list read page by page can also stop half way (a page timed out or failed). Those answers say `complete: false`, so
 * the caller can still show what it got without remembering it as the whole list.
 */

export type PlaylistKind = 'playlist' | 'album'
export type PlaylistBatchCallback = (batch: Track[], knownTotal?: number) => void

export interface FetchedTracks {
  tracks: Track[]
  /** False when the list was cut short by a failure, so what is here may be only the start of it. */
  complete: boolean
}

/** Longest list read page by page: a bound for a platform that never answers with a short page. */
const MAX_PLAYLIST_TRACKS = 100_000

type MetingJson = Record<string, unknown>

/** NetEase's song-detail endpoint cannot take more than about 1000 ids, so `playlist_track_all` is read in chunks. */
const NETEASE_CHUNK_SIZE = 1000
const NETEASE_DETAIL_CHUNK_SIZE = 500
const NETEASE_PLAYLIST_HEAD_TIMEOUT_MS = 5_000
const PLAYLIST_PAGE_CONCURRENCY = 3
const KUGOU_PAGE_SIZE = 300
const TENCENT_PAGE_SIZE = 100

// Path to the song list in the raw Meting answer of a playlist, per platform (NetEase is read through ncmApi instead).
const PLAYLIST_PATHS: Record<MusicSource, string> = {
  netease: 'playlist.tracks',
  tencent: 'data.cdlist.0.songlist', // JS arrays support string numeric index
  kugou: 'data.info',
}
const ALBUM_PATHS: Partial<Record<MusicSource, string>> = {
  tencent: 'data.getSongInfo',
  kugou: 'data.info',
}

export async function fetchNeteaseAlbumTracks(albumId: string): Promise<Track[]> {
  try {
    const res = await withTimeoutOrNull(ncmApi.album({ id: albumId, timestamp: Date.now() }), 30_000)
    if (res === null) {
      logger.warn(`Netease album timeout: ${albumId}`)
      return []
    }
    const songs = res?.body?.songs
    if (!Array.isArray(songs) || songs.length === 0) return []
    const tracks = songs
      .map((song: Record<string, unknown>) => rawToTrackOrNull(song, 'netease'))
      .filter((track): track is Track => track !== null)
    logger.info(`Netease album ${albumId}: ${tracks.length} tracks`)
    return tracks
  } catch (err) {
    logger.error(`Netease album failed: ${albumId}`, err)
    return []
  }
}

function mapNeteaseSongs(songs: Record<string, unknown>[]): Track[] {
  return songs
    .map((song) => (song && typeof song === 'object' ? rawToTrackOrNull(song, 'netease') : null))
    .filter((track): track is Track => track !== null)
}

export async function fetchNeteasePlaylistTracks(
  playlistId: string,
  cookie?: string | null,
  onBatch?: PlaylistBatchCallback,
): Promise<FetchedTracks> {
  const options = { timestamp: Date.now(), ...(cookie ? { cookie } : {}) }
  const baseParams = { id: playlistId, ...options }
  const detail = await withTimeoutOrNull(
    Promise.resolve().then(() => neteasePlaylistApi.playlist_detail(baseParams)),
    NETEASE_PLAYLIST_HEAD_TIMEOUT_MS,
  ).catch(() => null)
  const playlist = detail?.body?.code === 200 ? detail.body.playlist : undefined
  if (
    !Array.isArray(playlist?.tracks) ||
    !Array.isArray(playlist.trackIds) ||
    playlist.trackIds.some((entry) => !entry || !/^\d+$/.test(String(entry.id)))
  ) {
    return fetchNeteasePlaylistChunks(baseParams, onBatch)
  }

  const knownTotal = playlist.trackIds.length
  const ids = playlist.trackIds.slice(0, MAX_PLAYLIST_TRACKS).map(({ id }) => String(id))
  const byId = new Map(mapNeteaseSongs(playlist.tracks).map((track) => [track.sourceId, track]))
  const tracks: Track[] = []
  // Publish only the contiguous prefix, so an omitted head song cannot shift later pages.
  for (const id of ids) {
    const track = byId.get(id)
    if (!track) break
    tracks.push(track)
  }
  onBatch?.(tracks.slice(), knownTotal)

  const windowSize = NETEASE_DETAIL_CHUNK_SIZE * PLAYLIST_PAGE_CONCURRENCY
  for (let start = tracks.length; start < ids.length; start += windowSize) {
    const chunks: string[][] = []
    for (let offset = start; offset < Math.min(start + windowSize, ids.length); offset += NETEASE_DETAIL_CHUNK_SIZE) {
      chunks.push(ids.slice(offset, offset + NETEASE_DETAIL_CHUNK_SIZE))
    }
    const batches = await Promise.all(chunks.map(async (chunk) => {
      const missing = chunk.filter((id) => !byId.has(id))
      if (!missing.length) return byId
      try {
        const res = await withTimeoutOrNull(
          neteasePlaylistApi.song_detail({ ids: missing.join(','), ...options }),
          15_000,
        )
        const songs = res?.body?.code === 200 ? res.body.songs : undefined
        if (!Array.isArray(songs)) return null
        const fetched = new Map(mapNeteaseSongs(songs).map((track) => [track.sourceId, track]))
        return { get: (id: string) => byId.get(id) ?? fetched.get(id) }
      } catch {
        return null
      }
    }))
    for (const [index, batch] of batches.entries()) {
      if (!batch) {
        logger.warn(`Netease playlist ${playlistId} cut short at ${tracks.length} tracks`)
        return { tracks, complete: false }
      }
      const ordered: Track[] = []
      for (const id of chunks[index]) {
        const track = batch.get(id)
        if (track) ordered.push(track)
      }
      tracks.push(...ordered)
      if (ordered.length) onBatch?.(ordered, knownTotal)
    }
  }
  return { tracks, complete: true }
}

async function fetchNeteasePlaylistChunks(
  baseParams: { id: string; timestamp: number; cookie?: string },
  onBatch?: PlaylistBatchCallback,
): Promise<FetchedTracks> {
  const playlistId = baseParams.id
  const tracks: Track[] = []
  try {
    for (let offset = 0; offset < MAX_PLAYLIST_TRACKS; offset += NETEASE_CHUNK_SIZE) {
      const res = await withTimeoutOrNull(
        ncmApi.playlist_track_all({ ...baseParams, limit: NETEASE_CHUNK_SIZE, offset }),
        12_000,
      )
      if (res === null) {
        logger.warn(`Netease playlist_track_all timeout: ${playlistId} (offset=${offset})`)
        return { tracks, complete: false }
      }
      const songs = res?.body?.songs
      const code = res?.body?.code
      if ((code !== undefined && code !== 200) || !Array.isArray(songs)) {
        logger.warn(`Netease playlist_track_all failed: ${playlistId} (offset=${offset})`, { code })
        return { tracks, complete: false }
      }
      const batch = mapNeteaseSongs(songs)
      tracks.push(...batch)
      const short = songs.length < NETEASE_CHUNK_SIZE
      onBatch?.(batch, short ? tracks.length : undefined)
      if (short) return { tracks, complete: true }
    }
    return { tracks, complete: false }
  } catch (err) {
    logger.error(`Netease playlist_track_all failed: ${playlistId}`, err)
    return { tracks, complete: false }
  }
}

/** Kugou's native API (by global_collection_id): reaches user playlists Meting cannot. */
export function fetchKugouPlaylistTracks(
  playlistId: string,
  cookie?: string | null,
  onBatch?: PlaylistBatchCallback,
): Promise<FetchedTracks> {
  return fetchNativePlaylist(
    'kugou',
    playlistId,
    KUGOU_PAGE_SIZE,
    (page) => kugouAuth.getPlaylistTracks(playlistId, page, KUGOU_PAGE_SIZE, cookie),
    kugouSongToTrack,
    onBatch,
  )
}

/** QQ Music's native API (favourites and custom lists, through the encrypted-uin implementation). */
export function fetchTencentPlaylistTracks(
  playlistId: string,
  cookie?: string | null,
  onBatch?: PlaylistBatchCallback,
): Promise<FetchedTracks> {
  return fetchNativePlaylist(
    'tencent',
    playlistId,
    TENCENT_PAGE_SIZE,
    (page) => tencentAuth.getPlaylistTracks(playlistId, page, TENCENT_PAGE_SIZE, cookie),
    (song) => rawToTrackOrNull(song, 'tencent'),
    onBatch,
  )
}

async function fetchNativePlaylist(
  source: 'kugou' | 'tencent',
  playlistId: string,
  pageSize: number,
  getPage: (page: number) => Promise<{ songs: Record<string, unknown>[]; total: number }>,
  mapSong: (song: Record<string, unknown>) => Track | null,
  onBatch?: PlaylistBatchCallback,
): Promise<FetchedTracks> {
  const tracks: Track[] = []
  let fetched = 0
  let knownTotal = 0
  const append = (songs: Record<string, unknown>[]) => {
    fetched += songs.length
    const batch = songs.map(mapSong).filter((track): track is Track => track !== null)
    tracks.push(...batch)
    if (batch.length > 0) onBatch?.(batch, knownTotal || undefined)
  }
  const readPage = async (page: number) => {
    try {
      return await getPage(page)
    } catch {
      return null
    }
  }
  try {
    const head = await readPage(1)
    if (!head) return { tracks, complete: false }
    knownTotal = head.total > 0 && Number.isFinite(head.total) ? head.total : 0
    append(head.songs)
    if (head.songs.length < pageSize) return { tracks, complete: fetched >= knownTotal }

    const expectedTracks = knownTotal >= fetched ? knownTotal : MAX_PLAYLIST_TRACKS
    const maxPages = Math.ceil(Math.min(expectedTracks, MAX_PLAYLIST_TRACKS) / pageSize)
    for (let page = 2; page <= maxPages; page += PLAYLIST_PAGE_CONCURRENCY) {
      const count = Math.min(PLAYLIST_PAGE_CONCURRENCY, maxPages - page + 1)
      const pages = await Promise.all(Array.from({ length: count }, (_, index) => readPage(page + index)))
      for (const result of pages) {
        if (!result) return { tracks, complete: false }
        append(result.songs)
        if (result.songs.length < pageSize) return { tracks, complete: fetched >= knownTotal }
      }
    }
    return { tracks, complete: expectedTracks === knownTotal && fetched >= knownTotal && knownTotal <= MAX_PLAYLIST_TRACKS }
  } catch (err) {
    logger.error(`${source} playlist fetch failed: ${playlistId}`, err)
    return { tracks, complete: false }
  }
}

/**
 * A playlist or album through Meting's raw mode, which keeps the VIP/pay fields and duration the formatted mode strips.
 * The fallback for public lists, and the only source of Kugou and QQ albums.
 */
export async function fetchMetingTracks(
  source: MusicSource,
  playlistId: string,
  type: PlaylistKind = 'playlist',
): Promise<Track[]> {
  try {
    const meting = new Meting(source)
    const raw = await withTimeoutOrNull(
      type === 'album' ? meting.album(playlistId) : meting.playlist(playlistId),
      30_000,
    )
    if (raw === null) {
      logger.warn(`Playlist fetch timeout for ${source}: ${playlistId}`)
      return []
    }

    let rawData: MetingJson
    try {
      rawData = JSON.parse(raw as string) as MetingJson
    } catch {
      logger.error(`Playlist JSON parse failed for ${source}`, (raw as string)?.substring?.(0, 200))
      return []
    }

    const path = (type === 'album' ? ALBUM_PATHS[source] : undefined) ?? PLAYLIST_PATHS[source]
    const songs = navigatePath(rawData, path)
    if (!Array.isArray(songs) || songs.length === 0) return []

    const tracks = songs
      .map((song: MetingJson) => rawToTrackOrNull(song, source))
      .filter((track): track is Track => track !== null)
    logger.info(`Playlist ${playlistId} on ${source}: ${tracks.length} tracks (raw mode)`)
    return tracks
  } catch (err) {
    logger.error(`Get playlist failed for ${source}:`, err)
    return []
  }
}

/**
 * The tracks of a playlist or album from the right place for the platform: NetEase through ncmApi; Kugou and QQ through
 * their native API for playlists, falling back to Meting when that has nothing (public lists, special ids); albums and
 * anything else through Meting.
 */
export async function fetchPlaylistTracks(
  source: MusicSource,
  playlistId: string,
  type: PlaylistKind,
  cookie?: string | null,
  onBatch?: PlaylistBatchCallback,
): Promise<FetchedTracks> {
  if (source === 'netease') {
    if (type === 'playlist') return fetchNeteasePlaylistTracks(playlistId, cookie, onBatch)
    const tracks = await fetchNeteaseAlbumTracks(playlistId)
    onBatch?.(tracks, tracks.length)
    return { tracks, complete: true }
  }
  if (type === 'playlist' && (source === 'kugou' || source === 'tencent')) {
    const native =
      source === 'kugou'
        ? await fetchKugouPlaylistTracks(playlistId, cookie, onBatch)
        : await fetchTencentPlaylistTracks(playlistId, cookie, onBatch)
    if (native.tracks.length > 0) return native
    logger.info(`${source} native API returned empty for ${playlistId}, falling back to Meting`)
  }
  const tracks = await fetchMetingTracks(source, playlistId, type)
  onBatch?.(tracks, tracks.length)
  return { tracks, complete: true }
}
