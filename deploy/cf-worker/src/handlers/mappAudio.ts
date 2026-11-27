import { AUDIO_CONTENT_TYPES, MAX_MEDIA_BYTES } from '../../../../packages/shared/src/mediaContracts.js'
import { validateRelayMediaUrl } from '../relay/sources.js'
import type { WorkerEnv, WorkerRuntime } from '../types.js'

export const MAPP_AUDIO_PATH = '/api/mapp/audio'
const CORS_HEADERS = [
  'Access-Control-Allow-Origin',
  'Vary',
  'Access-Control-Allow-Methods',
  'Access-Control-Allow-Headers',
  'Access-Control-Expose-Headers',
]
const PRIVATE_CACHE_CONTROL = 'private, no-store, no-transform'
const RESOLVE_TIMEOUT_MS = 15_000
const CDN_HEADERS_TIMEOUT_MS = 6_000
const FALLBACK_HEADERS_TIMEOUT_MS = 25_000
const AUDIO_EXPOSE_HEADERS = 'Content-Length, Content-Type, Content-Encoding, Server-Timing'

type FallbackReason = 'size' | 'length' | 'encoding' | 'origin' | 'network'

class AudioRelayError extends Error {
  constructor(readonly reason: FallbackReason) {
    super(`Audio relay failed (${reason})`)
  }
}

async function withTimeout<T>(timeout: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    return await run(controller.signal)
  } finally {
    clearTimeout(timer)
  }
}

function relayHeaders(request: Request, mode: 'resolve-v1' | 'fallback-v1', secret: string): Headers {
  const headers = new Headers({ 'X-MT-Relay': mode, 'X-MT-Relay-Secret': secret })
  for (const name of ['Origin', 'Authorization']) {
    const value = request.headers.get(name)
    if (value !== null) headers.set(name, value)
  }
  return headers
}

function relayFailure(headers: Headers): Response {
  headers.set('Content-Type', 'application/json')
  headers.set('Cache-Control', 'no-store')
  return new Response(JSON.stringify({ code: 'MEDIA_RELAY_FAILED' }), { status: 503, headers })
}

function getAudioHeaders(response: Response, cors: Headers): { headers: Headers; length?: number } {
  if (response.status !== 200) throw new AudioRelayError('network')
  const type = (response.headers.get('Content-Type') ?? '').split(';', 1)[0].trim().toLowerCase()
  const encoding = (response.headers.get('Content-Encoding') ?? '').trim().toLowerCase()
  if (!AUDIO_CONTENT_TYPES.includes(type) || (encoding !== '' && encoding !== 'identity')) {
    throw new AudioRelayError('encoding')
  }
  const rawLength = response.headers.get('Content-Length')
  let length: number | undefined
  if (rawLength !== null) {
    length = Number(rawLength)
    if (!/^\d+$/.test(rawLength) || length <= 0) throw new AudioRelayError('length')
    if (length > MAX_MEDIA_BYTES) throw new AudioRelayError('size')
  }
  if (!response.body) throw new AudioRelayError('length')

  const headers = new Headers(cors)
  headers.set('Content-Type', type)
  if (length !== undefined) headers.set('Content-Length', String(length))
  headers.set('Content-Encoding', 'identity')
  headers.set('Cache-Control', PRIVATE_CACHE_CONTROL)
  headers.set('X-Content-Type-Options', 'nosniff')
  return { headers, length }
}

function cappedAudioStream(): TransformStream<Uint8Array, Uint8Array> {
  let bytes = 0
  return new TransformStream({
    transform(chunk, controller) {
      bytes += chunk.byteLength
      if (bytes > MAX_MEDIA_BYTES) throw new AudioRelayError('size')
      controller.enqueue(chunk)
    },
  })
}

type RelayResolution = { v?: unknown; source?: unknown; url?: unknown } | null

export async function handleMappAudio(
  request: Request,
  env: WorkerEnv,
  ctx: ExecutionContext,
  runtime: WorkerRuntime,
): Promise<Response> {
  const fetcher = runtime.fetch
  if (new URL(request.url).pathname !== MAPP_AUDIO_PATH) return fetcher(request)

  const allowedOrigin = env.ALLOWED_MAPP_ORIGIN?.trim()
  if (request.method === 'OPTIONS' && allowedOrigin && request.headers.get('Origin') === allowedOrigin) {
    const method = request.headers.get('Access-Control-Request-Method')
    const requested = request.headers.get('Access-Control-Request-Headers')?.split(',') ?? []
    if (
      (method === null || method === 'GET') &&
      requested.every((name) => ['authorization', 'content-type'].includes(name.trim().toLowerCase()))
    ) return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Expose-Headers': AUDIO_EXPOSE_HEADERS,
      'Access-Control-Max-Age': '86400',
      'Timing-Allow-Origin': allowedOrigin,
      'Cache-Control': 'no-store',
      'X-MT-Edge-Preflight': 'HIT',
    } })
  }
  const secret = env.MAPP_RELAY_SECRET?.trim()
  if (request.method !== 'GET' || !secret) {
    return fetcher(request)
  }

  const started = Date.now()
  let resolveMs: number | undefined
  let cdnMs: number | undefined
  function addTiming(headers: Headers, reason?: FallbackReason): void {
    const metrics: string[] = []
    if (resolveMs !== undefined) metrics.push(`vps_resolve;dur=${resolveMs}`)
    if (cdnMs !== undefined) metrics.push(`cdn_ttfb;dur=${cdnMs}`)
    metrics.push(`total;dur=${Date.now() - started}`)
    if (reason) metrics.push(`fallback;desc="${reason}"`)
    headers.append('Server-Timing', metrics.join(', '))
    const exposed = headers.get('Access-Control-Expose-Headers')?.split(',') ?? []
    if (!exposed.some((name) => name.trim().toLowerCase() === 'server-timing')) {
      headers.append('Access-Control-Expose-Headers', 'Server-Timing')
    }
    if (allowedOrigin) headers.set('Timing-Allow-Origin', allowedOrigin)
  }

  const cors = new Headers()
  let origin: Response
  let data: RelayResolution
  try {
    ({ origin, data } = await withTimeout(RESOLVE_TIMEOUT_MS, async (signal) => {
      const response = await fetcher(request.url, {
        headers: relayHeaders(request, 'resolve-v1', secret),
        redirect: 'manual',
        signal,
      })
      let resolution: RelayResolution = null
      if (response.status === 200 && response.headers.get('X-MT-Relay-Mode') === 'resolve-v1') {
        try {
          resolution = await response.json()
        } catch (error) {
          signal.throwIfAborted()
          if (!(error instanceof SyntaxError)) throw error
        }
      }
      return { origin: response, data: resolution }
    }))
    resolveMs = Date.now() - started
  } catch {
    if (allowedOrigin && request.headers.get('Origin') === allowedOrigin) {
      cors.set('Access-Control-Allow-Origin', allowedOrigin)
      cors.set('Vary', 'Origin')
    }
    addTiming(cors)
    return relayFailure(cors)
  }

  if (origin.status !== 200 || origin.headers.get('X-MT-Relay-Mode') !== 'resolve-v1') {
    const response = new Response(origin.body, origin)
    addTiming(response.headers)
    return response
  }
  for (const name of CORS_HEADERS) {
    const value = origin.headers.get(name)
    if (value !== null) cors.set(name, value)
  }

  let upstream: Response | undefined
  try {
    if (data?.v !== 1 || typeof data.source !== 'string' || typeof data.url !== 'string') {
      throw new AudioRelayError('origin')
    }
    const media = validateRelayMediaUrl(data.source, data.url)
    if (!media) throw new AudioRelayError('origin')

    const cdnStarted = Date.now()
    upstream = await withTimeout(CDN_HEADERS_TIMEOUT_MS, (signal) => fetcher(media.url.href, {
      method: 'GET',
      redirect: 'manual',
      headers: media.profile.buildUpstreamHeaders(),
      cf: { cacheTtl: 0, cacheEverything: false },
      signal,
    }))
    cdnMs = Date.now() - cdnStarted

    const { headers, length } = getAudioHeaders(upstream, cors)
    const { readable, writable } = length === undefined ? cappedAudioStream() : runtime.createFixedLengthStream(length)
    addTiming(headers)
    const response = new Response(readable, { status: 200, headers })
    ctx.waitUntil(upstream.body!.pipeTo(writable).catch(() => {}))
    return response
  } catch (error) {
    void upstream?.body?.cancel().catch(() => {})
    const reason = error instanceof AudioRelayError ? error.reason : 'network'
    const headers = relayHeaders(request, 'fallback-v1', secret)
    headers.set('X-MT-Relay-Reason', reason)
    try {
      const fallback = await withTimeout(FALLBACK_HEADERS_TIMEOUT_MS, (signal) => fetcher(request.url, {
        headers,
        redirect: 'manual',
        signal,
      }))
      const response = new Response(fallback.body, fallback)
      addTiming(response.headers, reason)
      return response
    } catch {
      addTiming(cors, reason)
      return relayFailure(cors)
    }
  }
}
