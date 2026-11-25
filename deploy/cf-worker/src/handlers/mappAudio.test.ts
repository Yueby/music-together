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
    for (const [header, value] of Object.entries(cors)) expect(response.headers.get(header)).toBe(value)
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

  it.each(['ab', 'abcd'])('fails the stream on invalid byte count (%j)', async (bytes) => {
    const { handler, runtime, ctx, pending } = fixture()
    runtime.fetch.mockResolvedValueOnce(resolution()).mockResolvedValueOnce(audio(bytes))
    const response = await handler(audioRequest(), env, ctx)
    await expect(response.text()).rejects.toThrow('bytes')
    await Promise.all(pending)
    expect(runtime.fetch).toHaveBeenCalledTimes(2)
  })

  it('allows CDN body transfer to take longer than eight seconds', async () => {
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

  it('times out on CDN headers and falls back without a request timeout', async () => {
    vi.useFakeTimers()
    const { handler, runtime, ctx } = fixture()
    runtime.fetch.mockResolvedValueOnce(resolution()).mockImplementationOnce((_url, init) => rejectOnAbort(init?.signal))
      .mockResolvedValueOnce(new Response('fallback'))
    const response = handler(audioRequest(), env, ctx)
    await vi.advanceTimersByTimeAsync(7_999)
    expect(runtime.fetch).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(await (await response).text()).toBe('fallback')
    expect(runtime.fetch.mock.calls[2][1]?.signal).toBeUndefined()
    expect(new Headers(runtime.fetch.mock.calls[2][1]?.headers).get('X-MT-Relay')).toBe('fallback-v1')
  })

  it.each([
    [302, 'audio/mpeg', '', '3'],
    [200, 'text/html', '', '3'],
    [200, 'audio/mpeg', 'gzip', '3'],
    [200, 'audio/mpeg', '', null],
    [200, 'audio/mpeg', '', '0'],
    [200, 'audio/mpeg', '', '3e0'],
    [200, 'audio/mpeg', '', String(MAX_MEDIA_BYTES + 1)],
  ])('discards invalid upstream body (%s, %s, %s, %s) and retries once', async (status, type, encoding, length) => {
    const { handler, runtime, ctx } = fixture()
    const cancel = vi.fn()
    const headers = new Headers({ 'Content-Type': type, 'Content-Encoding': encoding })
    if (length !== null) headers.set('Content-Length', length)
    const upstream = new Response(new ReadableStream({ cancel }), { status, headers })
    runtime.fetch.mockResolvedValueOnce(resolution()).mockResolvedValueOnce(upstream).mockResolvedValueOnce(audio())
    expect((await handler(audioRequest(), env, ctx)).status).toBe(200)
    expect(cancel).toHaveBeenCalledOnce()
    expect(runtime.fetch).toHaveBeenCalledTimes(3)
    const [fallbackUrl, fallbackInit] = runtime.fetch.mock.calls[2]
    expect(fallbackUrl).toBe(requestUrl)
    expect(fallbackInit?.redirect).toBe('manual')
    expect(Object.fromEntries(new Headers(fallbackInit?.headers))).toEqual({
      authorization: 'Bearer test', origin, 'x-mt-relay': 'fallback-v1', 'x-mt-relay-secret': 'test-secret',
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
    expect(new Headers(runtime.fetch.mock.calls[1][1]?.headers).get('X-MT-Relay')).toBe('fallback-v1')
  })

  it.each([401, 200])('returns origin status %s without a relay resolution in one trip', async (status) => {
    const { handler, runtime, ctx } = fixture()
    const response = new Response('origin', { status })
    runtime.fetch.mockResolvedValueOnce(response)
    expect(await handler(audioRequest(), env, ctx)).toBe(response)
    expect(runtime.fetch).toHaveBeenCalledOnce()
  })

  it('retains origin CORS headers when the fallback fails', async () => {
    const { handler, runtime, ctx } = fixture()
    runtime.fetch.mockResolvedValueOnce(resolution()).mockRejectedValueOnce(new Error()).mockRejectedValueOnce(new Error())
    const failure = await handler(audioRequest(), { MAPP_RELAY_SECRET: env.MAPP_RELAY_SECRET }, ctx)
    expect(failure.status).toBe(503)
    expect(failure.headers.get('Cache-Control')).toBe('no-store')
    for (const [header, value] of Object.entries(cors)) expect(failure.headers.get(header)).toBe(value)
    expect(await failure.json()).toEqual({ code: 'MEDIA_RELAY_FAILED' })
  })

  it('returns a CORS-enabled 503 on origin header timeout without retrying', async () => {
    vi.useFakeTimers()
    const { handler, runtime, ctx } = fixture()
    runtime.fetch.mockImplementationOnce((_url, init) => rejectOnAbort(init?.signal))
    const response = handler(audioRequest(), env, ctx)
    await vi.advanceTimersByTimeAsync(21_999)
    expect(runtime.fetch.mock.calls[0][1]?.signal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    const failure = await response
    expect(failure.status).toBe(503)
    expect(failure.headers.get('Access-Control-Allow-Origin')).toBe(origin)
    expect(await failure.json()).toEqual({ code: 'MEDIA_RELAY_FAILED' })
    expect(runtime.fetch).toHaveBeenCalledOnce()
  })
})

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
