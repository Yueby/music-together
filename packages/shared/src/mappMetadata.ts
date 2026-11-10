import { z } from 'zod'
import {
  searchQuerySchema,
  lyricQuerySchema,
  ttmlQuerySchema,
  artistQuerySchema,
  artistPageQuerySchema,
  myPlaylistQuerySchema,
  playlistQuerySchema,
} from './schemas.js'

import { MAPP_METADATA_TARGETS } from './mappMetadataTargets.js'
export {
  COVER_HOST_ALLOWLIST,
  MAPP_COVER_MAX_BYTES,
  MAPP_METADATA_MAX_BYTES,
  MAPP_METADATA_TARGETS,
} from './mappMetadataTargets.js'

export const mappMetadataSearchQuerySchema = searchQuerySchema.strict()
export const mappMetadataLyricQuerySchema = lyricQuerySchema.strict()
export const mappMetadataTtmlQuerySchema = ttmlQuerySchema.strict()
export const mappMetadataArtistQuerySchema = artistQuerySchema.strict()
export const mappMetadataArtistPageQuerySchema = artistPageQuerySchema.strict()

/** Most tracks one playlist/album page may carry: keeps the JSON (≈0.5 KB per track) far below the 1 MiB budget. */
export const MAPP_PLAYLIST_PAGE_MAX = 200

/**
 * Public playlist / album pages. The platform signs the exact set of query keys, so every key is always present
 * (`total` defaults to 0 = unknown). Personal playlists need an account and do not use this target.
 */
export const mappMetadataPlaylistQuerySchema = playlistQuerySchema
  .omit({ limit: true, total: true })
  .extend({
    limit: z.coerce.number().int().min(1).max(MAPP_PLAYLIST_PAGE_MAX).default(100),
    total: z.coerce.number().int().min(0).default(0),
  })
  .strict()

/** The caller's own playlist: same paging as the public target, plus the room that holds the account. */
export const mappMetadataMyPlaylistQuerySchema = myPlaylistQuerySchema
  .omit({ limit: true })
  .extend({ limit: z.coerce.number().int().min(1).max(MAPP_PLAYLIST_PAGE_MAX).default(100) })
  .strict()

/** Absolute https URL without credentials, fragment or whitespace. The host allowlist is enforced by the server. */
function isPlainHttpsUrl(value: string): boolean {
  if (/[\s\x00-\x1f\x7f#]/.test(value)) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && url.port === ''
  } catch {
    return false
  }
}
export const mappMetadataCoverQuerySchema = z.strictObject({ url: z.string().max(2048).refine(isPlainHttpsUrl) })

/**
 * The query schema of every reviewed target, keyed like `MAPP_METADATA_TARGETS`. This is the single table behind the
 * parser, the SDK client, the server adapter and (through `queryKeys`) the manifest endpoint declarations: adding a
 * target is one entry here, one in the targets file and one handler on the server. A test keeps `queryKeys` and the
 * schema keys from drifting apart.
 */
export const MAPP_METADATA_SCHEMAS = {
  search: mappMetadataSearchQuerySchema,
  lyric: mappMetadataLyricQuerySchema,
  ttml: mappMetadataTtmlQuerySchema,
  cover: mappMetadataCoverQuerySchema,
  artist: mappMetadataArtistQuerySchema,
  artistSongs: mappMetadataArtistPageQuerySchema,
  artistAlbums: mappMetadataArtistPageQuerySchema,
  playlist: mappMetadataPlaylistQuerySchema,
  myPlaylist: mappMetadataMyPlaylistQuerySchema,
} as const satisfies Record<keyof typeof MAPP_METADATA_TARGETS, z.ZodType>

export type MappMetadataKind = keyof typeof MAPP_METADATA_TARGETS
export type MappMetadataRequest = {
  [K in MappMetadataKind]: {
    kind: K
    target: (typeof MAPP_METADATA_TARGETS)[K]
    query: z.infer<(typeof MAPP_METADATA_SCHEMAS)[K]>
  }
}[MappMetadataKind]

const KINDS = Object.keys(MAPP_METADATA_TARGETS) as MappMetadataKind[]

/** One reviewed public-read contract shared by the SDK client and trusted server adapters. */
export function parseMappMetadataRequest(rawUrl: string): MappMetadataRequest {
  if (
    typeof rawUrl !== 'string' ||
    rawUrl.length > 8192 ||
    !rawUrl.startsWith('/') ||
    rawUrl.startsWith('//') ||
    /[^\x21-\x7e]|\\|#/.test(rawUrl) ||
    /%(?![0-9a-f]{2})/i.test(rawUrl)
  ) {
    throw new Error('METADATA_TARGET_REJECTED')
  }
  const url = new URL(rawUrl, 'https://metadata.invalid')
  const rawPath = rawUrl.split('?')[0]
  if (rawPath !== url.pathname) throw new Error('METADATA_TARGET_REJECTED')
  const kind = KINDS.find((candidate) => MAPP_METADATA_TARGETS[candidate].path === rawPath)
  if (!kind) throw new Error('METADATA_TARGET_REJECTED')

  const entries = [...url.searchParams]
  if (new Set(entries.map(([key]) => key)).size !== entries.length) throw new Error('METADATA_QUERY_REJECTED')
  try {
    for (const chunk of url.search.slice(1).split('&')) decodeURIComponent(chunk.replace(/\+/g, ' '))
  } catch {
    // A malformed escape is a rejected query like any other, not a stray URIError for callers to special-case.
    throw new Error('METADATA_QUERY_REJECTED')
  }
  const query = MAPP_METADATA_SCHEMAS[kind].parse(Object.fromEntries(entries), { jitless: true })
  return { kind, target: MAPP_METADATA_TARGETS[kind], query } as MappMetadataRequest
}
