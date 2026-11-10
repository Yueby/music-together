import { z } from 'zod'
import { searchQuerySchema, lyricQuerySchema, ttmlQuerySchema } from './schemas.js'

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

/** Absolute https URL without credentials, fragment or whitespace. The host allowlist is enforced by the server. */
function isPlainHttpsUrl(value: string): boolean {
  if (/[\s\x00-\x1f\x7f#]/.test(value)) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}
export const mappMetadataCoverQuerySchema = z.strictObject({ url: z.string().max(2048).refine(isPlainHttpsUrl) })

/** One reviewed public-read contract shared by the SDK client and trusted server adapters. */
export function parseMappMetadataRequest(rawUrl: string) {
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
  const entries = [...url.searchParams]
  if (new Set(entries.map(([key]) => key)).size !== entries.length) throw new Error('METADATA_QUERY_REJECTED')
  for (const chunk of url.search.slice(1).split('&')) decodeURIComponent(chunk.replace(/\+/g, ' '))
  const query = Object.fromEntries(entries)
  if (rawPath === MAPP_METADATA_TARGETS.search.path) {
    return {
      kind: 'search' as const,
      target: MAPP_METADATA_TARGETS.search,
      query: mappMetadataSearchQuerySchema.parse(query, { jitless: true }),
    }
  }
  if (rawPath === MAPP_METADATA_TARGETS.lyric.path) {
    return {
      kind: 'lyric' as const,
      target: MAPP_METADATA_TARGETS.lyric,
      query: mappMetadataLyricQuerySchema.parse(query, { jitless: true }),
    }
  }
  if (rawPath === MAPP_METADATA_TARGETS.ttml.path) {
    return {
      kind: 'ttml' as const,
      target: MAPP_METADATA_TARGETS.ttml,
      query: mappMetadataTtmlQuerySchema.parse(query, { jitless: true }),
    }
  }
  if (rawPath === MAPP_METADATA_TARGETS.cover.path) {
    return {
      kind: 'cover' as const,
      target: MAPP_METADATA_TARGETS.cover,
      query: mappMetadataCoverQuerySchema.parse(query, { jitless: true }),
    }
  }
  throw new Error('METADATA_TARGET_REJECTED')
}
