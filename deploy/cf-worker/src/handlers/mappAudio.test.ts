import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_MEDIA_BYTES } from '../../../../packages/shared/src/mediaContracts.js'
import { fixture } from '../../test/runtime.js'
import { SOURCE_RELAY_PROFILES, validateRelayMediaUrl } from '../relay/sources.js'

const origin = 'https://linux.do'
const signedUrl = 'https://m1.music.126.net/song?fakeSignature=example'
const requestUrl = 'https://mt.agou.mom/api/mapp/audio?z=1&a=%2B'
const env = { MAPP_RELAY_SECRET: 'test-secret', ALLOWED_MAPP_ORIGIN: origin }
const cors = {
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization',
  'Access-Control-Expose-Headers': 'Content-Length',
  Vary: 'Origin',
}

function expectRelayCors(response: Response) {
  for (const [header, value] of Object.entries(cors)) {
    expect(response.headers.get(header)).toBe(header === 'Access-Control-Expose-Headers' ? value + ', Server-Timing' : value)
  }
}

function audioRequest(method = 'GET') {
  return new Request(requestUrl, { method, headers: { Origin: origin, Authorization: 'Bearer test', Cookie: 'ignored=1' } })
}

function resolution(data: unknown = { v: 1, source: 'netease', url: signedUrl }) {
  return Response.json(data, { headers: { ...cors, 'X-MT-Relay-Mode': 'resolve-v1' } })
}

function audio(body: BodyInit = 'abc') {
  return new Response(body, { headers: { 'Content-Type': 'Audio/MPEG; test=1', 'Content-Length': '3' } })
}

function rejectOnAbort(signal: AbortSignal | null | undefined): Promise<Response> {
  return new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(signal.reason), { once: true }))
}

afterEach(() => vi.useRealTimers())

describe('mini-app audio relay', () => {
  it.each([
    ['OPTIONS', {}], ['POST', env], ['HEAD', env], ['GET', {}], ['GET', { MAPP_RELAY_SECRET: '   ' }],
  ])('passes %s through when ineligible', async (method, environment) => {
    const { handler, runtime, ctx } = fixture()
    const request = audioRequest(method)
    const response = new Response(null, { status: 204 })
    runtime.fetch.mockResolvedValueOnce(response)
    expect(await handler(request, environment, ctx)).toBe(response)
    expect(runtime.fetch.mock.calls).toEqual([[request]])
  })

  it('resolves the verbatim origin URL and streams the validated CDN bytes', async () => {
    const { handler, runtime, ctx, pending } = fixture()
    runtime.fetch.mockResolvedValueOnce(resolution()).mockResolvedValueOnce(audio())
    const response = await handler(audioRequest(), env, ctx)
    expect(runtime.fetch).toHaveBeenCalledTimes(2)
    const [resolveUrl, resolveInit] = runtime.fetch.mock.calls[0]
    expect(resolveUrl).toBe(requestUrl)
    expect(resolveInit?.redirect).toBe('manual')
    expect(Object.fromEntries(new Headers(resolveInit?.headers))).toEqual({
      authorization: 'Bearer test', origin, 'x-mt-relay': 'resolve-v1', 'x-mt-relay-secret': 'test-secret',
    })
    const [, cdnInit] = runtime.fetch.mock.calls[1]
    expect(runtime.fetch).toHaveBeenNthCalledWith(2, signedUrl, expect.objectContaining({
      method: 'GET', redirect: 'manual', cf: { cacheTtl: 0, cacheEverything: false },
      headers: { Accept: expect.any(String), 'Accept-Encoding': 'identity' },
    }))
    // workerd rejects combining `cache: 'no-store'` with `cf.cacheTtl !== -1`.
    expect(cdnInit?.cache).toBeUndefined()
    expect(response.status).toBe(200)
    expectRelayCors(response)
    expect(response.headers.get('Timing-Allow-Origin')).toBe(origin)
    expect(response.headers.get('Server-Timing')).toMatch(/^vps_resolve;dur=\d+, cdn_ttfb;dur=\d+, total;dur=\d+$/)
    expect(response.headers.get('Content-Type')).toBe('audio/mpeg')
    expect(response.headers.get('Content-Length')).toBe('3')
    expect(response.headers.get('Content-Encoding')).toBe('identity')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, no-transform')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(runtime.createFixedLengthStream).toHaveBeenCalledWith(3)
    expect(ctx.waitUntil).toHaveBeenCalledTimes(1)
    expect(await response.text()).toBe('abc')
    await Promise.all(pending)
  })

  it('streams valid audio without Content-Length', async () => {
    const { handler, runtime, ctx, pending } = fixture()
    runtime.fetch.mockResolvedValueOnce(resolution())
      .mockResolvedValueOnce(new Response('chunked', { headers: { 'Content-Type': 'audio/mpeg' } }))
    const response = await handler(audioRequest(), env, ctx)
    expect(response.headers.get('Content-Length')).toBeNull()
    expect(await response.text()).toBe('chunked')
    await Promise.all(pending)
    expect(runtime.createFixedLengthStream).not.toHaveBeenCalled()
    expect(runtime.fetch).toHaveBeenCalledTimes(2)
  })

  it('allows exactly 32 MiB and errors the stream on the next byte', async () => {
    const { handler, runtime, ctx, pending } = fixture()
    const cancel = vi.fn()
    const source = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_MEDIA_BYTES / 2))
        controller.enqueue(new Uint8Array(MAX_MEDIA_BYTES / 2))
        controller.enqueue(Uint8Array.of(1))
      },
      cancel,
    })
    runtime.fetch.mockResolvedValueOnce(resolution())
      .mockResolvedValueOnce(new Response(source, { headers: { 'Content-Type': 'audio/mpeg' } }))
    const response = await handler(audioRequest(), env, ctx)
    const reader = response.body!.getReader()
    expect((await reader.read()).value?.byteLength).toBe(MAX_MEDIA_BYTES / 2)
    expect((await reader.read()).value?.byteLength).toBe(MAX_MEDIA_BYTES / 2)
    await expect(reader.read()).rejects.toHaveProperty('reason', 'size')
    await Promise.all(pending)
    expect(cancel).toHaveBeenCalledOnce()
    expect(runtime.fetch).toHaveBeenCalledTimes(2)
  })

  it.each(['ab', 'abcd'])('fails the stream on invalid byte count (%j)', async (bytes) => {
    const { handler, runtime, ctx, pending } = fixture()
    runtime.fetch.mockResolvedValueOnce(resolution()).mockResolvedValueOnce(audio(bytes))
    const response = await handler(audioRequest(), env, ctx)
    await expect(response.text()).rejects.toThrow('bytes')
    await Promise.all(pending)
    expect(runtime.fetch).toHaveBeenCalledTimes(2)
  })

  it('allows CDN body transfer to take longer than the header timeout', async () => {
    vi.useFakeTimers()
    const { handler, runtime, ctx, pending } = fixture()
    let signal: AbortSignal | null | undefined
    runtime.fetch.mockResolvedValueOnce(resolution()).mockImplementationOnce(async (_url, init) => {
      signal = init?.signal
      return audio(new ReadableStream({
        start(controller) {
          signal?.addEventListener('abort', () => controller.error(signal?.reason), { once: true })
          setTimeout(() => {
            controller.enqueue(new TextEncoder().encode('abc'))
            controller.close()
          }, 12_000)
        },
      }))
    })
    const response = await handler(audioRequest(), env, ctx)
    const body = response.text()
    await vi.advanceTimersByTimeAsync(12_000)
    expect(signal?.aborted).toBe(false)
    expect(await body).toBe('abc')
    await Promise.all(pending)
  })

  it('times out on CDN headers at 6s and keeps the fallback body readable after its header timeout', async () => {
    vi.useFakeTimers()
    const { handler, runtime, ctx } = fixture()
    runtime.fetch.mockResolvedValueOnce(resolution()).mockImplementationOnce((_url, init) => rejectOnAbort(init?.signal))
      .mockResolvedValueOnce(new Response('fallback'))
    const response = handler(audioRequest(), env, ctx)
    await vi.advanceTimersByTimeAsync(5_999)
    expect(runtime.fetch).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    const fallback = await response
    await vi.advanceTimersByTimeAsync(25_000)
    expect(await fallback.text()).toBe('fallback')
    const init = runtime.fetch.mock.calls[2][1]
    expect(init?.signal?.aborted).toBe(false)
    expect(new Headers(init?.headers).get('X-MT-Relay-Reason')).toBe('network')
    expect(fallback.headers.get('Server-Timing')).toBe('vps_resolve;dur=0, total;dur=6000, fallback;desc="network"')
  })

  it('returns 503 when the fallback has not returned headers after 25s', async () => {
    vi.useFakeTimers()
    const { handler, runtime, ctx } = fixture()
    runtime.fetch.mockResolvedValueOnce(resolution(null))
      .mockImplementationOnce((_url, init) => rejectOnAbort(init?.signal))
    const response = handler(audioRequest(), env, ctx)
    await vi.advanceTimersByTimeAsync(24_999)
    expect(runtime.fetch.mock.calls[1][1]?.signal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    const failure = await response
    expect(failure.status).toBe(503)
    expect(failure.headers.get('Server-Timing')).toBe('vps_resolve;dur=0, total;dur=25000, fallback;desc="origin"')
  })

  it.each([
    ['network', 302, 'audio/mpeg', '', '3'],
    ['encoding', 200, 'text/html', '', '3'],
    ['encoding', 200, 'audio/mpeg', 'gzip', '3'],
    ['length', 200, 'audio/mpeg', '', '0'],
    ['length', 200, 'audio/mpeg', '', '3e0'],
    ['size', 200, 'audio/mpeg', '', String(MAX_MEDIA_BYTES + 1)],
  ])('falls back with %s for CDN status %s, type %s, encoding %j and length %s', async (reason, status, type, encoding, length) => {
    const { handler, runtime, ctx } = fixture()
    const cancel = vi.fn()
    const headers = new Headers({ 'Content-Type': type, 'Content-Encoding': encoding, 'Content-Length': length })
    const upstream = new Response(new ReadableStream({ cancel }), { status, headers })
    runtime.fetch.mockResolvedValueOnce(resolution()).mockResolvedValueOnce(upstream).mockResolvedValueOnce(audio())
    const response = await handler(audioRequest(), env, ctx)
    expect(response.status).toBe(200)
    expect(response.headers.get('Server-Timing')).toMatch(new RegExp(`cdn_ttfb;dur=\\d+, total;dur=\\d+, fallback;desc="${reason}"$`))
    expect(response.headers.get('Timing-Allow-Origin')).toBe(origin)
    expect(response.headers.get('Access-Control-Expose-Headers')).toBe('Server-Timing')
    expect(cancel).toHaveBeenCalledOnce()
    expect(runtime.fetch).toHaveBeenCalledTimes(3)
    const [fallbackUrl, fallbackInit] = runtime.fetch.mock.calls[2]
    expect(fallbackUrl).toBe(requestUrl)
    expect(fallbackInit?.redirect).toBe('manual')
    expect(Object.fromEntries(new Headers(fallbackInit?.headers))).toEqual({
      authorization: 'Bearer test', origin, 'x-mt-relay': 'fallback-v1', 'x-mt-relay-reason': reason, 'x-mt-relay-secret': 'test-secret',
    })
  })

  it.each([
    () => resolution({ v: 1, source: 'netease', url: 'https://example.org/file' }),
    () => resolution({ v: 2, source: 'netease', url: signedUrl }),
    () => resolution(null),
    () => new Response('{', { headers: { 'X-MT-Relay-Mode': 'resolve-v1' } }),
  ])('falls back directly on invalid resolution %#', async (makeResponse) => {
    const { handler, runtime, ctx } = fixture()
    runtime.fetch.mockResolvedValueOnce(makeResponse()).mockResolvedValueOnce(audio())
    expect((await handler(audioRequest(), env, ctx)).status).toBe(200)
    expect(runtime.fetch).toHaveBeenCalledTimes(2)
    expect(new Headers(runtime.fetch.mock.calls[1][1]?.headers).get('X-MT-Relay-Reason')).toBe('origin')
  })

  it.each([401, 200])('returns origin status %s without a relay resolution in one trip', async (status) => {
    const { handler, runtime, ctx } = fixture()
    const response = new Response('origin', { status })
    runtime.fetch.mockResolvedValueOnce(response)
    const passthrough = await handler(audioRequest(), env, ctx)
    expect(passthrough.status).toBe(status)
    expect(await passthrough.text()).toBe('origin')
    expect(passthrough.headers.get('Server-Timing')).toMatch(/^vps_resolve;dur=\d+, total;dur=\d+$/)
    expect(runtime.fetch).toHaveBeenCalledOnce()
  })

  it('retains origin CORS headers when the fallback fails', async () => {
    const { handler, runtime, ctx } = fixture()
    runtime.fetch.mockResolvedValueOnce(resolution()).mockRejectedValueOnce(new Error()).mockRejectedValueOnce(new Error())
    const failure = await handler(audioRequest(), { MAPP_RELAY_SECRET: env.MAPP_RELAY_SECRET }, ctx)
    expect(failure.status).toBe(503)
    expect(failure.headers.get('Cache-Control')).toBe('no-store')
    expectRelayCors(failure)
    expect(new Headers(runtime.fetch.mock.calls[2][1]?.headers).get('X-MT-Relay-Reason')).toBe('network')
    expect(await failure.json()).toEqual({ code: 'MEDIA_RELAY_FAILED' })
  })

  it('returns a CORS-enabled 503 on origin header timeout without retrying', async () => {
    vi.useFakeTimers()
    const { handler, runtime, ctx } = fixture()
    runtime.fetch.mockImplementationOnce((_url, init) => rejectOnAbort(init?.signal))
    const response = handler(audioRequest(), env, ctx)
    await vi.advanceTimersByTimeAsync(14_999)
    expect(runtime.fetch.mock.calls[0][1]?.signal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    const failure = await response
    expect(failure.status).toBe(503)
    expect(failure.headers.get('Access-Control-Allow-Origin')).toBe(origin)
    expect(await failure.json()).toEqual({ code: 'MEDIA_RELAY_FAILED' })
    expect(runtime.fetch).toHaveBeenCalledOnce()
  })

  it('includes reading the resolve JSON in the 15s budget', async () => {
    vi.useFakeTimers()
    const { handler, runtime, ctx } = fixture()
    runtime.fetch.mockImplementationOnce(async (_url, init) => resolutionWithStalledBody(init?.signal))
    const response = handler(audioRequest(), env, ctx)
    await vi.advanceTimersByTimeAsync(15_000)
    expect((await response).status).toBe(503)
    expect(runtime.fetch).toHaveBeenCalledOnce()
  })
})

function resolutionWithStalledBody(signal: AbortSignal | null | undefined) {
  const body = new ReadableStream({
    start(controller) {
      signal?.addEventListener('abort', () => controller.error(signal.reason), { once: true })
    },
  })
  return new Response(body, { headers: { 'X-MT-Relay-Mode': 'resolve-v1' } })
}

describe('relay source profiles', () => {
  it.each([
    ['netease', signedUrl],
    ['tencent', 'https://aqqmusic.tc.qq.com/song'],
    ['tencent', 'https://stream.qqmusic.qq.com/song'],
    ['kugou', 'https://stream.kugou.com/song'],
  ] as const)('uses the configured %s profile for %s', (source, url) => {
    expect(validateRelayMediaUrl(source, url)).toEqual({ profile: SOURCE_RELAY_PROFILES[source], url: new URL(url) })
  })

  it.each([
    ['toString', signedUrl],
    ['tencent', signedUrl],
    ['netease', 'https://music.126.net/song'],
    ['netease', 'https://evil-music.126.net/song'],
    ['netease', 'https://m1.music.126.net.evil.example/song'],
    ['netease', 'http://m1.music.126.net/song'],
    ['netease', 'https://m1.music.126.net:443/song'],
    ['netease', 'https://user:pass@m1.music.126.net/song'],
    ['netease', 'https://m1.music.126.net/song#'],
  ])('rejects invalid %s target %s', (source, url) => {
    expect(validateRelayMediaUrl(source, url)).toBeNull()
  })
})
