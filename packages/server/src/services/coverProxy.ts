import { MAPP_COVER_MAX_BYTES } from '@music-together/shared'

/**
 * Cover image fetching shared by the Web `/api/music/cover-proxy` route and the platform adapter.
 * Only the music CDNs below are ever contacted.
 */
export const ALLOWED_COVER_HOSTS = [
  'y.gtimg.cn',
  'p1.music.126.net',
  'p2.music.126.net',
  'p3.music.126.net',
  'p4.music.126.net',
  'imgessl.kugou.com',
]

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

/** Reads at most `maxBytes`; returns undefined as soon as the body is known to be larger. */
async function readBounded(response: Response, maxBytes: number): Promise<Buffer | undefined> {
  if (!response.body) return Buffer.alloc(0)
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => {})
      return undefined
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

/**
 * Throws on an invalid URL or a network failure/timeout; callers map that to their own error response.
 * Redirects are followed by the platform `fetch` (unchanged Web behaviour).
 */
export async function fetchCoverImage(
  imageUrl: string,
  maxBytes: number = MAX_WEB_COVER_BYTES,
  fetcher: typeof fetch = fetch,
): Promise<CoverResult> {
  const parsed = new URL(imageUrl)
  if (!ALLOWED_COVER_HOSTS.includes(parsed.hostname)) return { ok: false, status: 403, error: 'Host not allowed' }

  const response = await fetcher(imageUrl, {
    signal: AbortSignal.timeout(10_000),
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
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
