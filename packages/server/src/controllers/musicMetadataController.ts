import { searchQuerySchema, lyricQuerySchema, ttmlQuerySchema } from '@music-together/shared'
import { config } from '../config.js'
import { musicProvider } from '../services/musicProvider.js'
import { createTtmlService } from '../services/ttmlService.js'

export type MusicSearchQuery = ReturnType<typeof searchQuerySchema.parse>
export type MusicLyricQuery = ReturnType<typeof lyricQuerySchema.parse>
export type MusicTtmlQuery = ReturnType<typeof ttmlQuerySchema.parse>
export type MusicLyricMetadata = Awaited<ReturnType<typeof musicProvider.getLyric>>

const ttmlService = createTtmlService({ baseUrl: config.ttml.dbBaseUrl })

/** Public catalog orchestration shared by the Web route and the opt-in platform adapter. */
export async function searchMusicMetadata(data: MusicSearchQuery) {
  const { source, keyword, limit, page, type } = data
  const tracks =
    type === 'album'
      ? await musicProvider.searchAlbum(source, keyword, limit, page)
      : type === 'playlist'
        ? await musicProvider.searchPlaylist(source, keyword, limit, page)
        : await musicProvider.search(source, keyword, limit, page)
  return { tracks, page, hasMore: tracks.length >= limit }
}

export async function getMusicLyricMetadata(data: MusicLyricQuery): Promise<MusicLyricMetadata> {
  return musicProvider.getLyric(data.source, data.lyricId)
}

export function getMusicTtmlMetadata(data: MusicTtmlQuery) {
  return ttmlService.get(data.source, data.id)
}
