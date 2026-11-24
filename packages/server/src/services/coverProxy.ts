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
const IMAGE_TOO_LARGE: CoverResult = { ok: false, status: 413, error: 'Image too large', kind: 'invalid' }
const PROXY_BUSY: CoverResult = { ok: false, status: 503, error: 'Cover proxy busy', kind: 'upstream' }

interface CoverProxyOptions {
  maxCacheBytes?: number
  cacheTtlMs?: number
  maxConcurrent?: number
  maxQueued?: number
  queueTimeoutMs?: number
}

export function createCoverProxy({
  maxCacheBytes = 16 * 1024 * 1024,
  cacheTtlMs = 15 * 60_000,
  maxConcurrent = 16,
  maxQueued = 64,
  queueTimeoutMs = 10_000,
}: CoverProxyOptions = {}) {
  type CachedCover = Extract<CoverResult, { ok: true }> & { expiresAt: number }
  const cache = new Map<string, CachedCover>()
  const inFlight = new Map<string, Promise<CoverResult>>()
  const waiting: Array<() => void> = []
  let cachedBytes = 0
  let active = 0

  function evict(key: string, entry: CachedCover): void {
    cache.delete(key)
    cachedBytes -= entry.body.length
  }

  async function acquire(): Promise<boolean> {
    if (active < maxConcurrent) {
      active++
      return true
    }
    if (waiting.length >= maxQueued) return false
    return new Promise((resolve) => {
      const grant = () => {
        clearTimeout(timer)
        resolve(true)
      }
      const timer = setTimeout(() => {
        const index = waiting.indexOf(grant)
        if (index >= 0) waiting.splice(index, 1)
        resolve(false)
      }, queueTimeoutMs)
      timer.unref?.()
      waiting.push(grant)
    })
  }

  async function fetchAndCache(target: URL, key: string, maxBytes: number): Promise<CoverResult> {
    if (!(await acquire())) return PROXY_BUSY
    try {
      const result = await fetchUpstreamCover(target, maxBytes, fetch)
      if (result.ok && result.body.length > 0 && result.body.length <= Math.floor(maxCacheBytes / 4)) {
        const previous = cache.get(key)
        if (previous) evict(key, previous)
        for (const [oldKey, entry] of cache) {
          if (cachedBytes + result.body.length <= maxCacheBytes) break
          evict(oldKey, entry)
        }
        cache.set(key, { ...result, expiresAt: Date.now() + cacheTtlMs })
        cachedBytes += result.body.length
      }
      return result
    } finally {
      const next = waiting.shift()
      if (next) next()
      else active--
    }
  }

  return {
    async fetchCoverImage(imageUrl: string, maxBytes = MAX_WEB_COVER_BYTES): Promise<CoverResult> {
      const target = new URL(imageUrl)
      if (!isAllowedCoverTarget(target)) return HOST_REJECTED
      const key = target.toString()
      const cached = cache.get(key)
      if (cached) {
        if (Date.now() >= cached.expiresAt) {
          evict(key, cached)
        } else {
          if (cached.body.length > maxBytes) return IMAGE_TOO_LARGE
          cache.delete(key)
          cache.set(key, cached)
          return { ok: true, contentType: cached.contentType, body: cached.body }
        }
      }
      const requestKey = `${key}|${maxBytes}`
      const pending = inFlight.get(requestKey)
      if (pending) return pending
      const work = fetchAndCache(target, key, maxBytes).finally(() => inFlight.delete(requestKey))
      inFlight.set(requestKey, work)
      return work
    },
  }
}

const defaultCoverProxy = createCoverProxy()

/**
 * Throws on an invalid URL or a network failure/timeout; callers map that to their own error response.
 * Redirects are followed by hand and must land on the same allowlist over https: a CDN answering with a
 * redirect must not be able to move the server's request to another host or port.
 */
async function fetchUpstreamCover(target: URL, maxBytes: number, fetcher: typeof fetch): Promise<CoverResult> {
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
  if (!body) return IMAGE_TOO_LARGE
  return { ok: true, contentType, body }
}

export async function fetchCoverImage(
  imageUrl: string,
  maxBytes = MAX_WEB_COVER_BYTES,
  fetcher?: typeof fetch,
): Promise<CoverResult> {
  if (!fetcher) return defaultCoverProxy.fetchCoverImage(imageUrl, maxBytes)
  const target = new URL(imageUrl)
  if (!isAllowedCoverTarget(target)) return HOST_REJECTED
  return fetchUpstreamCover(target, maxBytes, fetcher)
}

/** Cover for mini-app clients: size-limited upstream request and the platform response cap. */
export function fetchPlatformCover(imageUrl: string, fetcher?: typeof fetch): Promise<CoverResult> {
  return fetchCoverImage(limitCoverSize(imageUrl), MAPP_COVER_MAX_BYTES, fetcher)
}
