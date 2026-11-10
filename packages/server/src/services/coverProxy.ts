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

/**
 * Why a fetch failed, independent of HTTP numbers: an upstream 403 (expired or hotlink-protected image) must not be
 * mistaken for "your host is not on our allowlist", which is a configuration problem.
 */
export type CoverFailure = 'host' | 'upstream' | 'invalid'

export type CoverResult =
  | { ok: true; contentType: string; body: Buffer }
  | { ok: false; status: number; error: string; kind: CoverFailure }

const MAX_COVER_REDIRECTS = 3

/** Allowlisted CDN host only, on the default port and without credentials. */
function isAllowedCoverTarget(url: URL): boolean {
  return ALLOWED_COVER_HOSTS.includes(url.hostname) && url.port === '' && !url.username && !url.password
}

const HOST_REJECTED: CoverResult = { ok: false, status: 403, error: 'Host not allowed', kind: 'host' }

/**
 * Throws on an invalid URL or a network failure/timeout; callers map that to their own error response.
 * Redirects are followed by hand and must land on the same allowlist over https: a CDN answering with a
 * redirect must not be able to move the server's request to another host or port.
 */
export async function fetchCoverImage(
  imageUrl: string,
  maxBytes: number = MAX_WEB_COVER_BYTES,
  fetcher: typeof fetch = fetch,
): Promise<CoverResult> {
  let target = new URL(imageUrl)
  if (!isAllowedCoverTarget(target)) return HOST_REJECTED

  const signal = AbortSignal.timeout(10_000)
  // An early return must not leave the upstream body unread: the socket stays busy until the timeout otherwise.
  const discard = async (res: Response) => {
    await res.body?.cancel().catch(() => {})
  }
  let response: Response | undefined
  for (let hop = 0; hop <= MAX_COVER_REDIRECTS; hop++) {
    response = await fetcher(target.toString(), { signal, redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (response.status < 300 || response.status >= 400) break
    const location = response.headers.get('location')
    await discard(response)
    const next = location ? new URL(location, target) : undefined
    if (!next || next.protocol !== 'https:' || !isAllowedCoverTarget(next)) return HOST_REJECTED
    target = next
    response = undefined
  }
  if (!response) return { ok: false, status: 502, error: 'Too many redirects', kind: 'upstream' }
  if (!response.ok) {
    await discard(response)
    return { ok: false, status: response.status, error: 'Upstream fetch failed', kind: 'upstream' }
  }

  const contentType = response.headers.get('content-type') || ''
  const contentLength = Number(response.headers.get('content-length') ?? 0)
  if (!contentType.startsWith('image/') || contentLength > maxBytes) {
    await discard(response)
    return { ok: false, status: 413, error: 'Invalid or oversized image', kind: 'invalid' }
  }

  const body = await readBounded(response, maxBytes)
  if (!body) return { ok: false, status: 413, error: 'Image too large', kind: 'invalid' }
  return { ok: true, contentType, body }
}

/** Cover for mini-app clients: size-limited upstream request and the platform response cap. */
export function fetchPlatformCover(imageUrl: string, fetcher: typeof fetch = fetch): Promise<CoverResult> {
  return fetchCoverImage(limitCoverSize(imageUrl), MAPP_COVER_MAX_BYTES, fetcher)
}
