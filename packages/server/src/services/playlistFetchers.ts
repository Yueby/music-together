import Meting from '@meting/core'
import ncmApi from '@neteasecloudmusicapienhanced/api'
import type { MusicSource, Track } from '@music-together/shared'
import { logger } from '../utils/logger.js'
import { withTimeoutOrNull } from '../utils/withTimeout.js'
import * as kugouAuth from './kugouAuthService.js'
import * as tencentAuth from './tencentAuthService.js'
import { kugouSongToTrack, navigatePath, rawToTrackOrNull } from './trackMapping.js'

/**
 * Where each platform's whole playlist or album comes from. Every fetcher answers the tracks in list order, or an empty
 * list when there is nothing, the request timed out or failed (logged). Pure fetching: no registry, no cache;
 * `MusicProvider` ingests what comes back.
 *
 * A list read page by page can also stop half way (a page timed out or failed). Those answers say `complete: false`, so
 * the caller can still show what it got without remembering it as the whole list.
 */

export type PlaylistKind = 'playlist' | 'album'

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

/**
 * The whole NetEase playlist through `playlist_track_all`, no 1000-track limit, with the full song data (duration, album,
 * artists); the caller's cookie reads private lists. The size is never taken from the caller (it comes in over the
 * wire, and the result is shared): the list is read until a chunk comes up short.
 */
export async function fetchNeteasePlaylistTracks(playlistId: string, cookie?: string | null): Promise<FetchedTracks> {
  const baseParams = { id: playlistId, timestamp: Date.now(), ...(cookie ? { cookie } : {}) }
  const tracks: Track[] = []
  let complete = true
  try {
    for (let offset = 0; offset < MAX_PLAYLIST_TRACKS; offset += NETEASE_CHUNK_SIZE) {
      const res = await withTimeoutOrNull(
        ncmApi.playlist_track_all({ ...baseParams, limit: NETEASE_CHUNK_SIZE, offset }),
        60_000,
      )
      if (res === null) {
        logger.warn(`Netease playlist_track_all timeout: ${playlistId} (offset=${offset})`)
        complete = false
        break
      }
      const songs = res?.body?.songs
      if (!Array.isArray(songs) || songs.length === 0) {
        // Nothing after a full chunk is the end of a list whose length is a multiple of the chunk size.
        if (offset === 0) logger.warn(`Netease playlist_track_all empty: ${playlistId}`, { code: res?.body?.code })
        break
      }
      for (const song of songs as Record<string, unknown>[]) {
        const track = rawToTrackOrNull(song, 'netease')
        if (track) tracks.push(track)
      }
      // A short chunk is the end of the list.
      if (songs.length < NETEASE_CHUNK_SIZE) break
    }
    if (tracks.length > 0) {
      logger.info(
        `Netease playlist ${playlistId}: ${tracks.length} tracks (via ncmApi, ${Math.ceil(tracks.length / NETEASE_CHUNK_SIZE)} chunks)`,
      )
    }
    return { tracks, complete }
  } catch (err) {
    logger.error(`Netease playlist_track_all failed: ${playlistId}`, err)
    return { tracks, complete: false }
  }
}

/** Kugou's native API (by global_collection_id): reaches user playlists Meting cannot. */
export async function fetchKugouPlaylistTracks(playlistId: string, cookie?: string | null): Promise<FetchedTracks> {
  const tracks: Track[] = []
  let complete = true
  try {
    let page = 1
    let totalFromApi = 0
    let fetched = 0
    while (fetched < MAX_PLAYLIST_TRACKS) {
      const { songs, total } = await kugouAuth.getPlaylistTracks(playlistId, page, KUGOU_PAGE_SIZE, cookie)
      if (page === 1) totalFromApi = total
      if (songs.length === 0) {
        // The API answers an empty page for a failure too: short of the size it announced, the list was cut off.
        complete = fetched >= totalFromApi
        break
      }
      fetched += songs.length
      for (const song of songs) {
        const track = kugouSongToTrack(song)
        if (track) tracks.push(track)
      }
      // Only a short page ends the list: the announced size may be missing or wrong.
      if (songs.length < KUGOU_PAGE_SIZE) break
      page++
    }
    if (tracks.length > 0)
      logger.info(`Kugou playlist ${playlistId}: ${tracks.length} tracks (via native API, ${page} pages)`)
    if (!complete) logger.warn(`Kugou playlist ${playlistId} cut short at ${tracks.length} tracks`)
    return { tracks, complete }
  } catch (err) {
    logger.error(`Kugou playlist fetch failed: ${playlistId}`, err)
    return { tracks, complete: false }
  }
}

/** QQ Music's native API (favourites and custom lists, through the encrypted-uin implementation). */
export async function fetchTencentPlaylistTracks(playlistId: string, cookie?: string | null): Promise<FetchedTracks> {
  const tracks: Track[] = []
  let complete = true
  try {
    let page = 1
    let totalFromApi = 0
    while (tracks.length < MAX_PLAYLIST_TRACKS) {
      const { songs, total } = await tencentAuth.getPlaylistTracks(playlistId, page, TENCENT_PAGE_SIZE, cookie)
      if (page === 1) totalFromApi = total
      if (songs.length === 0) {
        // The API answers an empty page for a failure too: short of the size it announced, the list was cut off.
        complete = tracks.length >= totalFromApi
        break
      }
      for (const song of songs) {
        const track = rawToTrackOrNull(song, 'tencent')
        if (track) tracks.push(track)
      }
      // Only a short page ends the list: the announced size may be missing or wrong.
      if (songs.length < TENCENT_PAGE_SIZE) break
      page++
    }
    if (tracks.length > 0)
      logger.info(`Tencent playlist ${playlistId}: ${tracks.length} tracks (via native API, ${page} pages)`)
    if (!complete) logger.warn(`Tencent playlist ${playlistId} cut short at ${tracks.length} tracks`)
    return { tracks, complete }
  } catch (err) {
    logger.error(`Tencent playlist fetch failed: ${playlistId}`, err)
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
): Promise<FetchedTracks> {
  if (source === 'netease') {
    return type === 'album'
      ? { tracks: await fetchNeteaseAlbumTracks(playlistId), complete: true }
      : fetchNeteasePlaylistTracks(playlistId, cookie)
  }
  if (type === 'playlist' && (source === 'kugou' || source === 'tencent')) {
    const native =
      source === 'kugou'
        ? await fetchKugouPlaylistTracks(playlistId, cookie)
        : await fetchTencentPlaylistTracks(playlistId, cookie)
    if (native.tracks.length > 0) return native
    logger.info(`${source} native API returned empty for ${playlistId}, falling back to Meting`)
  }
  return { tracks: await fetchMetingTracks(source, playlistId, type), complete: true }
}
