import {
  COVER_HOST_ALLOWLIST,
  MAPP_COVER_MAX_BYTES,
  MAX_WEB_COVER_BYTES,
  RASTER_IMAGE_TYPES,
} from '../../../../packages/shared/src/mediaContracts.js'
import type { WorkerEnv, WorkerRuntime } from '../types.js'

export const COVER_PROXY_PATH = '/api/music/cover-proxy'
const PUBLIC_CACHE = 'public, max-age=86400'
const PRIVATE_CACHE = 'private, no-store, no-transform'
const MAX_REDIRECTS = 3
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

type CoverRejection =
  | { kind: 'host'; status: 403; error: string }
  | { kind: 'invalid'; status: 413 | 415; error: string }

const HOST_REJECTED: CoverRejection = { kind: 'host', status: 403, error: 'Host not allowed' }
const IMAGE_TOO_LARGE: CoverRejection = { kind: 'invalid', status: 413, error: 'Image too large' }
const INVALID_TYPE: CoverRejection = { kind: 'invalid', status: 415, error: 'Unsupported image type' }

export function limitCoverSize(imageUrl: URL): string {
  if (/^p[1-4]\.music\.126\.net$/.test(imageUrl.hostname) && !imageUrl.searchParams.has('param')) {
    const resized = new URL(imageUrl)
    resized.searchParams.set('param', '600y600')
    return resized.href
  }
  return imageUrl.href
}

function readCoverTarget(url: URL, mapp: boolean): URL | null {
  const values = url.searchParams.getAll('url')
  const raw = values[0]
  if (values.length !== 1 || !raw) return null
  if (mapp && (url.searchParams.size !== 1 || raw.length > 2048 || /[\s\x00-\x1f\x7f#\\]/.test(raw))) {
    return null
  }
  // A parsed URL drops explicit default ports, so check the authority as supplied.
  const authority = /^https?:\/\/([^/?#\\]+)/i.exec(raw)?.[1]
  if (!authority || /[:@]/.test(authority)) return null
  try {
    const target = new URL(raw)
    if (target.protocol !== 'https:' && (mapp || target.protocol !== 'http:')) return null
    if (target.port || target.username || target.password) return null
    target.hash = ''
    return target
  } catch {
    return null
  }
}

type BoundedImageResult = { ok: true; body: ArrayBuffer } | { ok: false; reason: 'empty' | 'too-large' }

async function readBoundedImage(response: Response, maxBytes: number): Promise<BoundedImageResult> {
  if (!response.body) return { ok: false, reason: 'empty' }
  if (Number(response.headers.get('Content-Length')) > maxBytes) {
    await response.body.cancel().catch(() => {})
    return { ok: false, reason: 'too-large' }
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > maxBytes) {
        await reader.cancel().catch(() => {})
        return { ok: false, reason: 'too-large' }
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  if (length === 0) return { ok: false, reason: 'empty' }

  const image = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    image.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { ok: true, body: image.buffer }
}

async function fetchCover(
  url: string,
  maxBytes: number,
  fetcher: typeof fetch,
): Promise<Response | CoverRejection | { kind: 'upstream' }> {
  let target = new URL(url)
  const signal = AbortSignal.timeout(10_000)
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const upstream = await fetcher(target.href, {
        signal,
        redirect: 'manual',
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
      if (REDIRECT_STATUSES.has(upstream.status)) {
        const location = upstream.headers.get('Location')
        await upstream.body?.cancel().catch(() => {})
        if (!location) return HOST_REJECTED
        let next: URL
        try {
          next = new URL(location, target)
        } catch {
          return HOST_REJECTED
        }
        const authority = /^(?:https:)?\/\/([^/?#\\]+)/i.exec(location)?.[1]
        if (
          next.protocol !== 'https:' || next.port || next.username || next.password ||
          (authority && /[:@]/.test(authority)) || !COVER_HOST_ALLOWLIST.includes(next.hostname)
        ) return HOST_REJECTED
        target = next
        continue
      }
      if (upstream.status !== 200) {
        await upstream.body?.cancel().catch(() => {})
        return { kind: 'upstream' }
      }

      const type = (upstream.headers.get('Content-Type') ?? '').split(';', 1)[0].trim().toLowerCase()
      if (!RASTER_IMAGE_TYPES.includes(type)) {
        await upstream.body?.cancel().catch(() => {})
        return INVALID_TYPE
      }
      const read = await readBoundedImage(upstream, maxBytes)
      if (!read.ok) return read.reason === 'too-large' ? IMAGE_TOO_LARGE : { kind: 'upstream' }
      return new Response(read.body, {
        headers: { 'Content-Type': type, 'Content-Length': String(read.body.byteLength), 'Cache-Control': PUBLIC_CACHE },
      })
    }
  } catch {
    return { kind: 'upstream' }
  }
  return { kind: 'upstream' }
}

function mappHeaders(origin: string): Headers {
  return new Headers({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Vary': 'Origin',
    'Cache-Control': PRIVATE_CACHE,
  })
}

function coverResponse(cover: Response, edgeCache: 'HIT' | 'MISS', mappOrigin?: string): Response {
  const headers = mappOrigin ? mappHeaders(mappOrigin) : new Headers({
    'Access-Control-Allow-Origin': '*',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Cache-Control': PUBLIC_CACHE,
  })
  for (const name of ['Content-Type', 'Content-Length']) {
    const value = cover.headers.get(name)
    if (value !== null) headers.set(name, value)
  }
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-MT-Edge-Cache', edgeCache)
  return new Response(cover.body, { headers })
}

function coverError(failure: CoverRejection, mappOrigin?: string): Response {
  if (!mappOrigin) {
    return Response.json({ error: failure.error }, { status: failure.status, headers: { 'Cache-Control': 'no-store' } })
  }
  const hostRejected = failure.kind === 'host'
  const code = hostRejected ? 'METADATA_COVER_HOST_REJECTED' : 'METADATA_COVER_REJECTED'
  return Response.json({ code }, { status: hostRejected ? 403 : 503, headers: mappHeaders(mappOrigin) })
}

async function checkCachedMappCover(cover: Response): Promise<Response | null> {
  const length = cover.headers.get('Content-Length')
  if (length && /^\d+$/.test(length)) {
    if (Number(length) > 0 && Number(length) <= MAPP_COVER_MAX_BYTES) return cover
    await cover.body?.cancel().catch(() => {})
    return null
  }
  const read = await readBoundedImage(cover, MAPP_COVER_MAX_BYTES)
  if (!read.ok) return null
  const headers = new Headers(cover.headers)
  headers.set('Content-Length', String(read.body.byteLength))
  return new Response(read.body, { headers })
}

export async function handleCoverProxy(
  request: Request,
  env: WorkerEnv,
  ctx: ExecutionContext,
  { fetch: fetcher, cache }: WorkerRuntime,
): Promise<Response> {
  const url = new URL(request.url)
  const exactPath = url.pathname === COVER_PROXY_PATH
  if ((!exactPath && url.pathname !== COVER_PROXY_PATH + '/') || url.searchParams.has('mini_app_token')) {
    return fetcher(request)
  }

  const origin = request.headers.get('Origin')
  const allowedOrigin = env.ALLOWED_MAPP_ORIGIN?.trim()
  if (request.method === 'OPTIONS' && exactPath && allowedOrigin && origin === allowedOrigin) {
    const requested = (request.headers.get('Access-Control-Request-Headers') ?? '')
      .split(',').map((header) => header.trim().toLowerCase())
    if (
      request.headers.get('Access-Control-Request-Method') === 'GET' && requested.includes('authorization') &&
      requested.every((header) => header === 'authorization' || header === 'content-type')
    ) return new Response(null, { status: 204, headers: mappHeaders(allowedOrigin) })
  }
  if (request.method !== 'GET') return fetcher(request)

  const authorization = request.headers.get('Authorization')
  let mappOrigin: string | undefined
  if (authorization !== null) {
    if (
      !exactPath || !allowedOrigin || origin !== allowedOrigin ||
      authorization.length > 8199 || !/^Bearer [A-Za-z0-9_.-]+$/.test(authorization)
    ) return fetcher(request)
    mappOrigin = allowedOrigin
  }

  const target = readCoverTarget(url, mappOrigin !== undefined)
  if (!target) {
    if (mappOrigin) return fetcher(request)
    return Response.json({ error: 'Missing url parameter' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }
  if (!COVER_HOST_ALLOWLIST.includes(target.hostname)) return coverError(HOST_REJECTED, mappOrigin)
  target.protocol = 'https:'
  const normalized = limitCoverSize(target)
  const cacheKey = new URL('/__mt_edge_cache/cover?url=' + encodeURIComponent(normalized), url.origin).href
  const cached = await cache.match(cacheKey).catch(() => undefined)
  if (cached) {
    const cover = mappOrigin ? await checkCachedMappCover(cached).catch(() => null) : cached
    return cover ? coverResponse(cover, 'HIT', mappOrigin) : coverError(IMAGE_TOO_LARGE, mappOrigin)
  }

  const result = await fetchCover(normalized, mappOrigin ? MAPP_COVER_MAX_BYTES : MAX_WEB_COVER_BYTES, fetcher)
  if (result instanceof Response) {
    ctx.waitUntil(cache.put(cacheKey, result.clone()).catch(() => {}))
    return coverResponse(result, 'MISS', mappOrigin)
  }
  if (result.kind !== 'upstream') return coverError(result, mappOrigin)

  try {
    return await fetcher(request)
  } catch {
    if (!mappOrigin) {
      return Response.json({ error: 'Cover proxy failed' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
    }
    return Response.json({ code: 'METADATA_COVER_FAILED' }, { status: 503, headers: mappHeaders(mappOrigin) })
  }
}
