import { MAPP_METADATA_TARGETS } from '../../../../packages/shared/src/mappMetadataTargets.js'
import type { WorkerEnv, WorkerRuntime } from '../types.js'

const TTML_PATH = MAPP_METADATA_TARGETS.ttml.path
const EDGE_TTL_HEADER = 'X-MT-Edge-TTL'
const EDGE_FRESH_UNTIL_HEADER = 'X-MT-Edge-Fresh-Until'
const ORIGIN_TIMEOUT_MS = 25_000
const METADATA_TTLS = new Map<string, number>([
  [TTML_PATH, 21_600],
  [MAPP_METADATA_TARGETS.lyric.path, 1_800],
  [MAPP_METADATA_TARGETS.radar.path, 600],
  [MAPP_METADATA_TARGETS.artist.path, 300],
  [MAPP_METADATA_TARGETS.artistSongs.path, 300],
  [MAPP_METADATA_TARGETS.artistAlbums.path, 300],
  [MAPP_METADATA_TARGETS.playlist.path, 300],
  [MAPP_METADATA_TARGETS.search.path, 180],
])

interface BufferedMetadata {
  body: ArrayBuffer | null
  status: number
  statusText: string
  headers: [string, string][]
  ttl: number
}

type MetadataResult = BufferedMetadata | 'unavailable'
const inFlight = new Map<string, Promise<MetadataResult | null>>()

export function isPublicMetadataPath(pathname: string): boolean {
  return METADATA_TTLS.has(pathname)
}

function stripPrivateHeaders(headers: Headers): void {
  headers.delete('Set-Cookie')
  headers.delete('RateLimit')
  headers.delete('RateLimit-Policy')
  for (const name of [...headers.keys()]) {
    if (name.startsWith('access-control-')) headers.delete(name)
  }
}

function stripEdgeHeaders(headers: Headers): void {
  headers.delete(EDGE_TTL_HEADER)
  headers.delete(EDGE_FRESH_UNTIL_HEADER)
}

function addRequestVariance(headers: Headers): void {
  const vary = (headers.get('Vary') ?? '').toLowerCase().split(',').map((name) => name.trim())
  if (vary.includes('*')) return
  for (const name of ['Origin', 'Authorization']) {
    if (!vary.includes(name.toLowerCase())) headers.append('Vary', name)
  }
}

function getCacheTtl(response: Response, pathname: string, defaultTtl: number): number | null {
  if (response.status !== 200) return 0
  const directives = (response.headers.get('Cache-Control') ?? '').split(',').map((value) => value.trim())
  if (directives.some((value) => /^(?:no-store|no-cache)(?:\s*=|$)/i.test(value))) return 0
  const maxAges = directives.flatMap((value) => {
    const match = /^max-age\s*=\s*(?:"(\d+)"|(\d+))$/i.exec(value)
    return match ? [Number(match[1] ?? match[2])] : []
  })
  if (maxAges.includes(0)) return 0
  if (pathname !== TTML_PATH) return defaultTtl
  return maxAges.length ? Math.min(defaultTtl, ...maxAges) : null
}

const nowSeconds = () => Math.floor(Date.now() / 1000)

function originUnavailable(): Response {
  return Response.json({ error: 'Origin unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
}

async function readMetadata(
  request: Request,
  pathname: string,
  defaultTtl: number,
  fetcher: typeof fetch,
  refresh: boolean,
): Promise<MetadataResult | Response> {
  const headers = new Headers(request.headers)
  headers.delete('Cookie')
  if (refresh) {
    for (const name of ['If-Match', 'If-None-Match', 'If-Modified-Since', 'If-Unmodified-Since', 'If-Range', 'Range']) {
      headers.delete(name)
    }
  }
  try {
    const upstream = await fetcher(request.url, {
      headers, redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(ORIGIN_TIMEOUT_MS),
    })
    let ttl = getCacheTtl(upstream, pathname, defaultTtl)
    const responseHeaders = new Headers(upstream.headers)
    stripEdgeHeaders(responseHeaders)
    responseHeaders.delete('Set-Cookie')
    responseHeaders.set('X-MT-Edge-Cache', 'MISS')
    const { status, statusText } = upstream
    if (ttl === 0) return new Response(upstream.body, { status, statusText, headers: responseHeaders })

    const body = upstream.body === null ? null : await upstream.arrayBuffer()
    // Reading a Worker fetch body decodes it. Let the runtime encode the new response for each client.
    responseHeaders.delete('Content-Encoding')
    responseHeaders.delete('Content-Length')
    if (ttl === null) {
      try {
        const data: { lines?: unknown } | null = JSON.parse(new TextDecoder().decode(body ?? undefined))
        ttl = data?.lines === null ? 600 : defaultTtl
      } catch {
        return new Response(body, { status, statusText, headers: responseHeaders })
      }
    }
    stripPrivateHeaders(responseHeaders)
    return { body, status, statusText, headers: [...responseHeaders], ttl }
  } catch {
    return 'unavailable'
  }
}

function storeMetadata(cache: WorkerRuntime['cache'], cacheKey: string, metadata: BufferedMetadata): Promise<void> {
  const { body, status, ttl } = metadata
  const headers = new Headers(metadata.headers)
  headers.delete('Vary')
  headers.delete('X-MT-Edge-Cache')
  headers.set('Cache-Control', `public, s-maxage=${ttl * 2}, max-age=${ttl * 2}`)
  headers.set(EDGE_TTL_HEADER, String(ttl))
  headers.set(EDGE_FRESH_UNTIL_HEADER, String(nowSeconds() + ttl))
  return cache.put(cacheKey, new Response(body, { status, headers }))
}

function metadataMiss(metadata: BufferedMetadata): Response {
  const headers = new Headers(metadata.headers)
  headers.set('Cache-Control', 'public, max-age=' + metadata.ttl)
  addRequestVariance(headers)
  return new Response(metadata.body, { status: metadata.status, statusText: metadata.statusText, headers })
}

export async function handlePublicMetadata(
  request: Request,
  env: WorkerEnv,
  ctx: ExecutionContext,
  { fetch: fetcher, cache }: WorkerRuntime,
): Promise<Response> {
  const url = new URL(request.url)
  const defaultTtl = METADATA_TTLS.get(url.pathname)
  if (defaultTtl === undefined) return fetcher(request)
  const origin = request.headers.get('Origin')
  const allowedOrigin = env.ALLOWED_MAPP_ORIGIN?.trim()
  if (request.method === 'OPTIONS' && allowedOrigin && origin === allowedOrigin) {
    const requested = (request.headers.get('Access-Control-Request-Headers') ?? '')
      .split(',').map((name) => name.trim().toLowerCase())
    if (
      request.headers.get('Access-Control-Request-Method') === 'GET' && requested.includes('authorization') &&
      requested.every((name) => name === 'authorization' || name === 'content-type')
    ) return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': '86400',
      'Cache-Control': 'no-store',
      'X-MT-Edge-Preflight': 'HIT',
    } })
  }
  if (
    request.method !== 'GET' || request.headers.has('Authorization') ||
    url.searchParams.has('mini_app_token') || (origin !== null && origin !== url.origin)
  ) return fetcher(request)

  url.searchParams.sort()
  // Use a dedicated internal cache namespace so Worker-cached public entries never
  // collide with Cloudflare's CDN cache on raw public URLs (e.g. mapp/cross-origin passthrough).
  const cacheKey = new URL('/__mt_edge_cache/meta' + url.pathname + url.search, url.origin).href
  const cached = await cache.match(cacheKey).catch(() => undefined)
  let ownResponse: Response | undefined

  function startRead(refresh: boolean, ttl: number): Promise<MetadataResult | null> {
    const flight = readMetadata(request, url.pathname, ttl, fetcher, refresh).then(async (result) => {
      if (result instanceof Response) {
        // Uncacheable responses may be request-specific. Only the request that fetched one can serve it.
        if (refresh) await result.body?.cancel().catch(() => {})
        else ownResponse = result
        return null
      }
      return result
    })
    inFlight.set(cacheKey, flight)
    // Keep the owning request alive if its client disconnects while other requests are waiting.
    ctx.waitUntil(flight.then((result) => {
      if (result && result !== 'unavailable') return storeMetadata(cache, cacheKey, result)
      if (inFlight.get(cacheKey) === flight) inFlight.delete(cacheKey)
    }).catch(() => {}).finally(() => {
      if (inFlight.get(cacheKey) === flight) inFlight.delete(cacheKey)
    }))
    return flight
  }

  if (cached) {
    const headers = new Headers(cached.headers)
    stripPrivateHeaders(headers)
    headers.delete('Age')
    headers.delete('Date')
    const rawTtl = Number(headers.get(EDGE_TTL_HEADER))
    const freshUntil = Number(headers.get(EDGE_FRESH_UNTIL_HEADER))
    stripEdgeHeaders(headers)
    // Cloudflare's zone Browser Cache TTL (default 4h = 14400s) can rewrite Cache-Control
    // stored in caches.default; restore the route's intended TTL for client responses.
    const ttl = Number.isInteger(rawTtl) && rawTtl > 0 ? Math.min(rawTtl, defaultTtl) : defaultTtl
    const hasFreshUntil = Number.isSafeInteger(freshUntil) && freshUntil > 0
    const remaining = hasFreshUntil ? freshUntil - nowSeconds() : ttl
    const stale = remaining < 0
    const maxAge = Math.min(ttl, stale ? 30 : remaining)
    headers.set('Cache-Control', 'public, max-age=' + maxAge)
    addRequestVariance(headers)
    headers.set('X-MT-Edge-Cache', stale ? 'STALE' : 'HIT')
    if (stale && !inFlight.has(cacheKey)) startRead(true, defaultTtl)
    return new Response(cached.body, { status: cached.status, headers })
  }

  const existing = inFlight.get(cacheKey)
  let result: MetadataResult | null
  if (existing) {
    const timedOut = Symbol('timeout')
    let timer: ReturnType<typeof setTimeout> | undefined
    const raced = await Promise.race([
      existing,
      new Promise<typeof timedOut>((resolve) => { timer = setTimeout(() => resolve(timedOut), ORIGIN_TIMEOUT_MS + 1_000) }),
    ]).finally(() => clearTimeout(timer))
    result = raced === timedOut ? null : raced
  } else {
    result = await startRead(false, defaultTtl)
  }
  if (result === 'unavailable') return originUnavailable()
  if (result) return metadataMiss(result)
  if (ownResponse) return ownResponse
  const retry = await readMetadata(request, url.pathname, defaultTtl, fetcher, false)
  if (retry === 'unavailable') return originUnavailable()
  return retry instanceof Response ? retry : metadataMiss(retry)
}
