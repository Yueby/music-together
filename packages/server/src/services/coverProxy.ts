import { COVER_HOST_ALLOWLIST, MAPP_COVER_MAX_BYTES } from '@music-together/shared'
import { readBounded } from '../utils/readBounded.js'

/**
 * Cover image fetching shared by the Web `/api/music/cover-proxy` route and the platform adapter.
 * Only the music CDNs of the shared allowlist (the one the mini-app checks too) are ever contacted.
 */
export const ALLOWED_COVER_HOSTS: readonly string[] = COVER_HOST_ALLOWLIST

export const MAX_WEB_COVER_BYTES = 10 * 1024 * 1024

const NETEASE_COVER_HOST = /^p[1-4]\.music\.126\.net$/
/** Player-sized artwork: ~0.5 MB instead of the multi-megabyte original. */
const PLATFORM_COVER_SIZE = '600y600'

/**
 * NetEase serves the multi-megabyte original unless asked for a size. Request a player-sized image
 * unless the caller already chose one (list thumbnails carry `param=120y120`). Other hosts are untouched.
 */
export function limitCoverSize(imageUrl: string): string {
  try {
    const parsed = new URL(imageUrl)
    if (!NETEASE_COVER_HOST.test(parsed.hostname) || parsed.searchParams.has('param')) return imageUrl
    parsed.searchParams.set('param', PLATFORM_COVER_SIZE)
    return parsed.toString()
  } catch {
    return imageUrl
  }
}

export type CoverResult = { ok: true; contentType: string; body: Buffer } | { ok: false; status: number; error: string }

const MAX_COVER_REDIRECTS = 3

/**
 * Throws on an invalid URL or a network failure/timeout; callers map that to their own error response.
 * Redirects are followed by hand and must land on the same allowlist over https: a CDN answering with a
 * redirect must not be able to move the server's request to another host.
 */
export async function fetchCoverImage(
  imageUrl: string,
  maxBytes: number = MAX_WEB_COVER_BYTES,
  fetcher: typeof fetch = fetch,
): Promise<CoverResult> {
  let target = new URL(imageUrl)
  if (!ALLOWED_COVER_HOSTS.includes(target.hostname)) return { ok: false, status: 403, error: 'Host not allowed' }

  const signal = AbortSignal.timeout(10_000)
  let response: Response | undefined
  for (let hop = 0; hop <= MAX_COVER_REDIRECTS; hop++) {
    response = await fetcher(target.toString(), { signal, redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (response.status < 300 || response.status >= 400) break
    const location = response.headers.get('location')
    await response.body?.cancel().catch(() => {})
    const next = location ? new URL(location, target) : undefined
    if (!next || next.protocol !== 'https:' || !ALLOWED_COVER_HOSTS.includes(next.hostname)) {
      return { ok: false, status: 403, error: 'Host not allowed' }
    }
    target = next
    response = undefined
  }
  if (!response) return { ok: false, status: 502, error: 'Too many redirects' }
  if (!response.ok) return { ok: false, status: response.status, error: 'Upstream fetch failed' }

  const contentType = response.headers.get('content-type') || ''
  const contentLength = Number(response.headers.get('content-length') ?? 0)
  if (!contentType.startsWith('image/') || contentLength > maxBytes) {
    return { ok: false, status: 413, error: 'Invalid or oversized image' }
  }

  const body = await readBounded(response, maxBytes)
  if (!body) return { ok: false, status: 413, error: 'Image too large' }
  return { ok: true, contentType, body }
}

/** Cover for mini-app clients: size-limited upstream request and the platform response cap. */
export function fetchPlatformCover(imageUrl: string, fetcher: typeof fetch = fetch): Promise<CoverResult> {
  return fetchCoverImage(limitCoverSize(imageUrl), MAPP_COVER_MAX_BYTES, fetcher)
}
