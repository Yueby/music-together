import { searchQuerySchema, lyricQuerySchema } from './schemas.js'

import { MAPP_METADATA_TARGETS } from './mappMetadataTargets.js'
export { MAPP_METADATA_MAX_BYTES, MAPP_METADATA_TARGETS } from './mappMetadataTargets.js'

export const mappMetadataSearchQuerySchema = searchQuerySchema.strict()
export const mappMetadataLyricQuerySchema = lyricQuerySchema.strict()

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
  throw new Error('METADATA_TARGET_REJECTED')
}
