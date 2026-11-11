import type { MusicSource, Playlist } from '@music-together/shared'
import { httpsCoverUrl } from '../utils/httpsCoverUrl.js'
import { deriveThumbnailCoverUrl } from './coverUrls.js'

/**
 * Playlists, albums and artists are shown as a cover grid, whose tiles are bigger than the 120px list thumbnail and far
 * smaller than the original artwork (often over 1 MB).
 */
export const GRID_COVER_SIZE = 256

/**
 * A playlist as the cover grid needs it: https artwork (an http:// address is blocked on an https page and refused by
 * the mini-app's cover endpoint) and a right-sized thumbnail. Only NetEase can resize to any size; the other platforms
 * keep the artwork they return.
 */
export function withGridCovers(source: MusicSource, playlist: Playlist): Playlist {
  const cover = httpsCoverUrl(playlist.cover)
  const thumbnailCover =
    source === 'netease' && cover
      ? deriveThumbnailCoverUrl(source, cover, GRID_COVER_SIZE)
      : playlist.thumbnailCover
        ? httpsCoverUrl(playlist.thumbnailCover)
        : undefined
  return { ...playlist, cover, ...(thumbnailCover ? { thumbnailCover } : {}) }
}
