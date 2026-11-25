import type { WorkerRuntime } from '../types.js'

const TTML_PATH = '/api/music/ttml'
const METADATA_TTLS = new Map([
  [TTML_PATH, 21_600],
  ['/api/music/lyric', 1_800],
  ['/api/music/discover/radar', 600],
  ['/api/music/artist', 300],
  ['/api/music/artist/songs', 300],
  ['/api/music/artist/albums', 300],
  ['/api/music/playlist', 300],
  ['/api/music/search', 180],
])

export function isPublicMetadataPath(pathname: string): boolean {
  return METADATA_TTLS.has(pathname)
}

function stripPrivateHeaders(headers: Headers): void {
  headers.delete('Set-Cookie')
  for (const name of [...headers.keys()]) {
    if (name.startsWith('access-control-')) headers.delete(name)
  }
}

function addRequestVariance(headers: Headers): void {
  const vary = (headers.get('Vary') ?? '').toLowerCase().split(',').map((name) => name.trim())
  if (vary.includes('*')) return
  for (const name of ['Origin', 'Authorization']) {
    if (!vary.includes(name.toLowerCase())) headers.append('Vary', name)
  }
}

async function getCacheTtl(response: Response, pathname: string, defaultTtl: number): Promise<number> {
  if (response.status !== 200) return 0
  const directives = (response.headers.get('Cache-Control') ?? '').split(',').map((value) => value.trim())
  if (directives.some((value) => /^(?:no-store|no-cache)(?:\s*=|$)/i.test(value))) return 0
  const maxAges = directives.flatMap((value) => {
    const match = /^max-age\s*=\s*(?:"(\d+)"|(\d+))$/i.exec(value)
    return match ? [Number(match[1] ?? match[2])] : []
  })
  if (maxAges.includes(0)) return 0
  if (pathname !== TTML_PATH) return defaultTtl
  if (maxAges.length) return Math.min(defaultTtl, ...maxAges)

  try {
    const data: { lines?: unknown } | null = await response.clone().json()
    return data?.lines === null ? 600 : defaultTtl
  } catch {
    return 0
  }
}

export async function handlePublicMetadata(
  request: Request,
  ctx: ExecutionContext,
  { fetch: fetcher, cache }: WorkerRuntime,
): Promise<Response> {
  const url = new URL(request.url)
  const defaultTtl = METADATA_TTLS.get(url.pathname)
  const origin = request.headers.get('Origin')
  if (
    defaultTtl === undefined || request.method !== 'GET' || request.headers.has('Authorization') ||
    url.searchParams.has('mini_app_token') || (origin !== null && origin !== url.origin)
  ) return fetcher(request)

  url.searchParams.sort()
  // Use a dedicated internal cache namespace so Worker-cached public entries never
  // collide with Cloudflare's CDN cache on raw public URLs (e.g. mapp/cross-origin passthrough).
  const cacheKey = new URL('/__mt_edge_cache/meta' + url.pathname + url.search, url.origin).href
  const cached = await cache.match(cacheKey).catch(() => undefined)
  if (cached) {
    const headers = new Headers(cached.headers)
    stripPrivateHeaders(headers)
    addRequestVariance(headers)
    headers.set('X-MT-Edge-Cache', 'HIT')
    return new Response(cached.body, { status: cached.status, headers })
  }

  const upstreamHeaders = new Headers(request.headers)
  upstreamHeaders.delete('Cookie')
  let upstream: Response
  try {
    upstream = await fetcher(request.url, { headers: upstreamHeaders, redirect: 'manual', cache: 'no-store' })
  } catch {
    return Response.json({ error: 'Origin unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
  const ttl = await getCacheTtl(upstream, url.pathname, defaultTtl)
  const headers = new Headers(upstream.headers)
  headers.delete('Set-Cookie')
  headers.set('X-MT-Edge-Cache', 'MISS')
  if (ttl > 0) {
    const cacheControl = 'public, max-age=' + ttl
    const cacheHeaders = new Headers(upstream.headers)
    stripPrivateHeaders(cacheHeaders)
    cacheHeaders.delete('Vary')
    cacheHeaders.delete('X-MT-Edge-Cache')
    cacheHeaders.set('Cache-Control', cacheControl)
    const entry = new Response(upstream.clone().body, { status: upstream.status, headers: cacheHeaders })
    ctx.waitUntil(cache.put(cacheKey, entry).catch(() => {}))
    headers.set('Cache-Control', cacheControl)
    addRequestVariance(headers)
  }
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers })
}
