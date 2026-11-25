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

async function fetchWithHeaderTimeout(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit,
  timeout: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    return await fetcher(url, { ...init, signal: controller.signal })
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

function getAudioHeaders(response: Response, cors: Headers): { headers: Headers; length: number } {
  const type = (response.headers.get('Content-Type') ?? '').split(';', 1)[0].trim().toLowerCase()
  const encoding = (response.headers.get('Content-Encoding') ?? '').trim().toLowerCase()
  const rawLength = (response.headers.get('Content-Length') ?? '').trim()
  const length = Number(rawLength)
  if (
    response.status !== 200 || !response.body || !AUDIO_CONTENT_TYPES.includes(type) ||
    (encoding !== '' && encoding !== 'identity') || !/^\d+$/.test(rawLength) ||
    !Number.isInteger(length) || length <= 0 || length > MAX_MEDIA_BYTES
  ) throw new Error('Invalid audio response')

  const headers = new Headers(cors)
  headers.set('Content-Type', type)
  headers.set('Content-Length', String(length))
  headers.set('Content-Encoding', 'identity')
  headers.set('Cache-Control', PRIVATE_CACHE_CONTROL)
  headers.set('X-Content-Type-Options', 'nosniff')
  return { headers, length }
}

export async function handleMappAudio(
  request: Request,
  env: WorkerEnv,
  ctx: ExecutionContext,
  runtime: WorkerRuntime,
): Promise<Response> {
  const fetcher = runtime.fetch
  const secret = env.MAPP_RELAY_SECRET?.trim()
  if (new URL(request.url).pathname !== MAPP_AUDIO_PATH || request.method !== 'GET' || !secret) {
    return fetcher(request)
  }

  const cors = new Headers()
  let origin: Response
  try {
    origin = await fetchWithHeaderTimeout(fetcher, request.url, {
      headers: relayHeaders(request, 'resolve-v1', secret),
      redirect: 'manual',
    }, 22_000)
  } catch {
    const allowedOrigin = env.ALLOWED_MAPP_ORIGIN?.trim()
    if (allowedOrigin && request.headers.get('Origin') === allowedOrigin) {
      cors.set('Access-Control-Allow-Origin', allowedOrigin)
      cors.set('Vary', 'Origin')
    }
    return relayFailure(cors)
  }

  if (origin.status !== 200 || origin.headers.get('X-MT-Relay-Mode') !== 'resolve-v1') return origin
  for (const name of CORS_HEADERS) {
    const value = origin.headers.get(name)
    if (value !== null) cors.set(name, value)
  }

  let upstream: Response | undefined
  try {
    const data: { v?: unknown; source?: unknown; url?: unknown } | null = await origin.json()
    if (data?.v !== 1 || typeof data.source !== 'string' || typeof data.url !== 'string') {
      throw new Error('Invalid relay resolution')
    }
    const media = validateRelayMediaUrl(data.source, data.url)
    if (!media) throw new Error('Invalid relay target')

    upstream = await fetchWithHeaderTimeout(fetcher, media.url.href, {
      method: 'GET',
      redirect: 'manual',
      headers: media.profile.buildUpstreamHeaders(),
      cf: { cacheTtl: 0, cacheEverything: false },
    }, 8_000)

    const { headers, length } = getAudioHeaders(upstream, cors)
    const { readable, writable } = runtime.createFixedLengthStream(length)
    const response = new Response(readable, { status: 200, headers })
    ctx.waitUntil(upstream.body!.pipeTo(writable).catch(() => {}))
    return response
  } catch {
    await upstream?.body?.cancel().catch(() => {})
    try {
      return await fetcher(request.url, {
        headers: relayHeaders(request, 'fallback-v1', secret),
        redirect: 'manual',
      })
    } catch {
      return relayFailure(cors)
    }
  }
}
