import { getMusicJson } from '@/lib/musicApi'
import type { Artist, MusicSource } from '@music-together/shared'

const LOOKUP_LIMIT = 5

/** Case, width and spacing differences must not keep a name from matching itself. */
function sameName(a: string, b: string): boolean {
  const key = (name: string) => name.normalize('NFKC').replace(/\s+/g, '').toLowerCase()
  return key(a) === key(b)
}

/**
 * The artist a name refers to: the search hit with exactly that name. For a track that carries no platform id for its
 * artists. `null` when no hit has that name: a fuzzy first hit would open somebody else's page, which is worse than
 * saying the artist was not found.
 */
export async function findArtistByName(source: MusicSource, name: string, signal: AbortSignal): Promise<Artist | null> {
  // Every key of the search target is sent (the mini-app's reviewed target carries all five).
  const body = await getMusicJson<{ tracks?: Artist[] }>(
    'search',
    { source, keyword: name, limit: LOOKUP_LIMIT, page: 1, type: 'artist' },
    signal,
  )
  return (body.tracks ?? []).find((artist) => sameName(artist.name, name)) ?? null
}
