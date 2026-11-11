import { ARTIST_SOURCES, UNKNOWN_ARTIST } from '@music-together/shared'
import type { MusicSource, Track } from '@music-together/shared'
import type { ArtistTarget } from '@/stores/artistPageStore'

/** Whether a platform has artist pages to open. */
export function hasArtistPages(source: MusicSource): boolean {
  return ARTIST_SOURCES.includes(source)
}

/** Whether a credited name is somebody: the placeholder for "nobody credited" is not, and links to nothing. */
export function isRealArtistName(name: string): boolean {
  return name !== '' && name !== UNKNOWN_ARTIST
}

/**
 * The artists credited on a track, each with what is needed to open its page. Platform ids are used only when they line
 * up with the names (a track from an older queue or another path may carry names alone: those are found by name).
 */
export function trackArtists(track: Pick<Track, 'source' | 'artist' | 'artistIds'>): ArtistTarget[] {
  const ids = track.artistIds && track.artistIds.length === track.artist.length ? track.artistIds : undefined
  return track.artist.map((name, index) => ({
    source: track.source,
    name,
    ...(ids?.[index] ? { id: ids[index] } : {}),
  }))
}
