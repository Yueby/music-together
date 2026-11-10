import {
  searchQuerySchema,
  lyricQuerySchema,
  ttmlQuerySchema,
  artistQuerySchema,
  artistPageQuerySchema,
} from '@music-together/shared'
import { config } from '../config.js'
import { artistService } from '../services/artistService.js'
import { musicProvider } from '../services/musicProvider.js'
import { createTtmlService } from '../services/ttmlService.js'

export type MusicSearchQuery = ReturnType<typeof searchQuerySchema.parse>
export type ArtistQuery = ReturnType<typeof artistQuerySchema.parse>
export type ArtistPageQuery = ReturnType<typeof artistPageQuerySchema.parse>
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
