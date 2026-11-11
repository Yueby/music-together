import {
  searchQuerySchema,
  lyricQuerySchema,
  ttmlQuerySchema,
  artistQuerySchema,
  artistPageQuerySchema,
  dailyQuerySchema,
  discoverQuerySchema,
  homeQuerySchema,
  myPlaylistQuerySchema,
  playlistQuerySchema,
  type MusicSource,
} from '@music-together/shared'
import { config } from '../config.js'
import { discoverService } from '../services/discoverService.js'
import { roomRepo } from '../repositories/roomRepository.js'
import * as authService from '../services/authService.js'
import { artistService } from '../services/artistService.js'
import { musicProvider } from '../services/musicProvider.js'
import { createTtmlService } from '../services/ttmlService.js'

export type MusicSearchQuery = ReturnType<typeof searchQuerySchema.parse>
export type ArtistQuery = ReturnType<typeof artistQuerySchema.parse>
export type ArtistPageQuery = ReturnType<typeof artistPageQuerySchema.parse>
export type PlaylistPageQuery = ReturnType<typeof playlistQuerySchema.parse>
export type MyPlaylistPageQuery = ReturnType<typeof myPlaylistQuerySchema.parse>
export type DailyQuery = ReturnType<typeof dailyQuerySchema.parse>
export type DiscoverQuery = ReturnType<typeof discoverQuerySchema.parse>
export type HomeQuery = ReturnType<typeof homeQuerySchema.parse>
export type MusicLyricQuery = ReturnType<typeof lyricQuerySchema.parse>
export type MusicTtmlQuery = ReturnType<typeof ttmlQuerySchema.parse>
export type MusicLyricMetadata = Awaited<ReturnType<typeof musicProvider.getLyric>>

const ttmlService = createTtmlService({ baseUrl: config.ttml.dbBaseUrl })

/** Public catalog orchestration shared by the Web route and the opt-in platform adapter. */
export async function searchMusicMetadata(data: MusicSearchQuery) {
  const { source, keyword, limit, page, type } = data
  // `tracks` is the historical name of the result list; it holds albums, playlists or artists for those search types.
  const tracks =
    type === 'album'
      ? await musicProvider.searchAlbum(source, keyword, limit, page)
      : type === 'playlist'
        ? await musicProvider.searchPlaylist(source, keyword, limit, page)
        : type === 'artist'
          ? await artistService.search(source, keyword, limit, page)
          : await musicProvider.search(source, keyword, limit, page)
  return { tracks, page, hasMore: tracks.length >= limit }
}

/**
 * One page of a playlist or album. `cookie` is only ever the caller's own (resolved by the Web route from the room
 * account pool); public targets pass `null`. The provider keeps its caches apart by kind and credentials.
 */
export async function getPlaylistPageMetadata(
  data: Pick<PlaylistPageQuery, 'source' | 'id' | 'limit' | 'offset' | 'type'> & { total?: number },
  cookie: string | null,
) {
  const { source, id, limit, offset, total, type } = data
  // 0 means "unknown" (the mini-app always sends the key), exactly like an absent hint.
  const result = await musicProvider.getPlaylistPage(source, id, limit, offset, total || undefined, cookie, type)
  return { tracks: result.tracks, total: result.total, offset, hasMore: result.hasMore }
}

/** The caller may not read this room's account pool (not logged in, or not a member of the room). */
export class PlaylistAccessError extends Error {
  constructor(readonly status: 401 | 403) {
    super(status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN')
    this.name = 'PlaylistAccessError'
  }
}

/**
 * A page of the caller's own playlist. `userId` is the *verified* identity (Web cookie or platform token), never a
 * client-supplied value; the login used is the one this user put into the room's account pool.
 */
export function getMyPlaylistPageMetadata(data: MyPlaylistPageQuery, userId: string | undefined) {
  return getPlaylistPageMetadata(data, callerAccountCookie(data.source, data.roomId, userId))
}

/**
 * The login `userId` put into the room's account pool, after checking the caller really is that user and in that room.
 * `null` means "in the room, but not logged in to this platform".
 */
function callerAccountCookie(source: MusicSource, roomId: string, userId: string | undefined): string | null {
  if (!userId) throw new PlaylistAccessError(401)
  const room = roomRepo.get(roomId)
  if (!room || !room.users.some((user) => user.id === userId)) throw new PlaylistAccessError(403)
  return authService.getUserCookie(userId, source, roomId)
}

/** Today's recommended songs for the caller's own login. */
export function getDailyMetadata(data: DailyQuery, userId: string | undefined) {
  return discoverService
    .getDaily(data.source, callerAccountCookie(data.source, data.roomId, userId))
    .then((items) => ({ items }))
}

/** Recommended playlists, artists and new albums; the playlists are the caller's own when they are signed in. */
export function getHomeMetadata(data: HomeQuery, userId: string | undefined) {
  return discoverService.getHome(data.source, callerAccountCookie(data.source, data.roomId, userId))
}

/** The radar playlists (the same for everyone). */
export function getRadarMetadata(data: DiscoverQuery) {
  return discoverService.getRadar(data.source).then((items) => ({ items }))
}

export function getArtistMetadata(data: ArtistQuery) {
  return artistService.getArtist(data.source, data.id)
}

export function getArtistSongsMetadata(data: ArtistPageQuery) {
  return artistService.getSongs(data.source, data.id, data.offset, data.limit)
}

export function getArtistAlbumsMetadata(data: ArtistPageQuery) {
  return artistService.getAlbums(data.source, data.id, data.offset, data.limit)
}

export async function getMusicLyricMetadata(data: MusicLyricQuery): Promise<MusicLyricMetadata> {
  return musicProvider.getLyric(data.source, data.lyricId)
}

export function getMusicTtmlMetadata(data: MusicTtmlQuery) {
  return ttmlService.get(data.source, data.id)
}
