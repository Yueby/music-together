import type { Track } from '@music-together/shared'
import { nanoid } from 'nanoid'
import { roomRepo } from '../repositories/roomRepository.js'
import { httpsCoverUrl } from '../utils/httpsCoverUrl.js'

/** Artwork that a browser may be pointed at: https only (after upgrading the known music CDNs). Anything else is dropped. */
function safeArtworkUrl(url: string | undefined): string | undefined {
  if (!url) return url
  const upgraded = httpsCoverUrl(url)
  return upgraded.startsWith('https://') ? upgraded : ''
}

/**
 * Tracks a member sends to the queue are a description of a song, not something to trust as it is:
 * - `streamUrl` is what every client loads and plays. It is only ever filled in by the server when it resolves the
 *   track, so one that arrives with the track is dropped (or anybody could make the whole room fetch their address).
 * - artwork must be an https address.
 * - the `id` the client chose is the key of the queue (remove, reorder, "next after this one"). One that is already
 *   taken, or taken twice in the same batch, is replaced so the queue never holds two entries with one id.
 */
export function sanitizeIncomingTracks(roomId: string, tracks: Track[], requestedBy: string): Track[] {
  const room = roomRepo.get(roomId)
  const taken = new Set<string>(room?.queue.map((t) => t.id))
  if (room?.currentTrack) taken.add(room.currentTrack.id)
  if (room?.pendingPlayback?.track) taken.add(room.pendingPlayback.track.id)

  return tracks.map((incoming) => {
    const { streamUrl: _dropped, ...track } = incoming
    const id = track.id && !taken.has(track.id) ? track.id : nanoid()
    taken.add(id)
    return {
      ...track,
      id,
      cover: safeArtworkUrl(track.cover) ?? '',
      ...(track.thumbnailCover !== undefined ? { thumbnailCover: safeArtworkUrl(track.thumbnailCover) } : {}),
      requestedBy,
    }
  })
}
