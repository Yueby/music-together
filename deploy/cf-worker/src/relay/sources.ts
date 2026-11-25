import { MEDIA_CDN_SUFFIXES } from '../../../../packages/shared/src/mediaContracts.js'

export interface SourceRelayProfile {
  cdnSuffixes: readonly string[]
  buildUpstreamHeaders: () => Record<string, string>
}

function audioHeaders(): Record<string, string> {
  return { Accept: 'audio/*, application/octet-stream, application/ogg', 'Accept-Encoding': 'identity' }
}

// Add future sources here with their CDN suffixes and required headers. For
// example, a Bilibili profile can extend audioHeaders() with its fixed Referer.
export const SOURCE_RELAY_PROFILES: Readonly<Record<string, SourceRelayProfile>> = {
  netease: { cdnSuffixes: MEDIA_CDN_SUFFIXES.netease, buildUpstreamHeaders: audioHeaders },
  tencent: { cdnSuffixes: MEDIA_CDN_SUFFIXES.tencent, buildUpstreamHeaders: audioHeaders },
  kugou: { cdnSuffixes: MEDIA_CDN_SUFFIXES.kugou, buildUpstreamHeaders: audioHeaders },
}

export function validateRelayMediaUrl(
  source: string,
  rawUrl: string,
): { profile: SourceRelayProfile; url: URL } | null {
  if (!Object.hasOwn(SOURCE_RELAY_PROFILES, source)) return null
  // Inspect the raw authority too, since URL normalizes explicit default ports away.
  if (!/^https:\/\/[^/?#: @\\]+(?:[/?]|$)/i.test(rawUrl) || rawUrl.includes('#')) return null

  const profile = SOURCE_RELAY_PROFILES[source]
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
    if (!profile.cdnSuffixes.some((suffix) => url.hostname.endsWith(`.${suffix}`))) return null
    return { profile, url }
  } catch {
    return null
  }
}
