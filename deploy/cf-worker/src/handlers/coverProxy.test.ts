import { describe, expect, it, vi } from 'vitest'
import { MAPP_COVER_MAX_BYTES, MAX_WEB_COVER_BYTES } from '../../../../packages/shared/src/mediaContracts.js'
import { fixture } from '../../test/runtime.js'

const path = 'https://mt.agou.mom/api/music/cover-proxy'
const imageUrl = 'https://p1.music.126.net/cover'
const resized = imageUrl + '?param=600y600'
const cacheKey = 'https://mt.agou.mom/__mt_edge_cache/cover?url=' + encodeURIComponent(resized)
const origin = 'https://linux.do'
const env = { ALLOWED_MAPP_ORIGIN: origin }
const auth = { Origin: origin, Authorization: 'Bearer abc-_.123' }

function coverRequest(target = imageUrl, headers?: HeadersInit, extra = '') {
  return new Request(path + '?url=' + encodeURIComponent(target) + extra, { headers })
}

function image(body: BodyInit = 'image bytes', headers?: HeadersInit) {
  return new Response(body, {
    headers: {
      'Content-Type': 'image/png; charset=binary',
      'Access-Control-Allow-Origin': 'https://cdn.example',
      'Set-Cookie': 'ignored=1',
      Vary: 'Origin',
      ...headers,
    },
  })
}

function redirect(location: string) {
  return new Response(null, { status: 302, headers: { Location: location } })
}

function expectMappHeaders(response: Response) {
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin)
  expect(response.headers.get('Vary')).toBe('Origin')
  expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS')
  expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Authorization, Content-Type')
  expect(response.headers.get('Cache-Control')).toBe('private, no-store, no-transform')
}

describe('Web covers', () => {
  it('normalizes NetEase size, caches a clean MISS, and serves a reusable HIT', async () => {
    const { handler, runtime, ctx, pending, entries } = fixture()
    runtime.fetch.mockResolvedValueOnce(image())
    const miss = await handler(coverRequest(imageUrl.replace('https:', 'http:')), {}, ctx)
    expect(runtime.fetch).toHaveBeenCalledWith(resized, expect.objectContaining({
      redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0' },
    }))
    expect(await miss.text()).toBe('image bytes')
    expect(miss.headers.get('X-MT-Edge-Cache')).toBe('MISS')
    expect(ctx.waitUntil).toHaveBeenCalledOnce()
    await Promise.all(pending)
    const stored = entries.get(cacheKey)
    expect(Object.fromEntries(stored!.headers)).toEqual({
      'cache-control': 'public, max-age=86400', 'content-type': 'image/png', 'content-length': '11',
    })
    const hit = await handler(new Request(path + '/?url=' + encodeURIComponent(resized)), {}, ctx)
    expect(await hit.text()).toBe('image bytes')
    expect(hit.headers.get('X-MT-Edge-Cache')).toBe('HIT')
    expect(hit.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(hit.headers.get('Cache-Control')).toBe('public, max-age=86400')
    expect(hit.headers.get('Content-Security-Policy')).toBe("default-src 'none'; sandbox")
    expect(hit.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(runtime.fetch).toHaveBeenCalledOnce()
  })

  it('follows up to three allowlisted HTTPS redirects', async () => {
    const { handler, runtime, ctx, pending } = fixture()
    runtime.fetch.mockResolvedValueOnce(redirect('/next'))
      .mockResolvedValueOnce(redirect('https://y.gtimg.cn/another'))
      .mockResolvedValueOnce(redirect('https://imgessl.kugou.com/final'))
      .mockResolvedValueOnce(image())
    const response = await handler(coverRequest(), {}, ctx)
    expect(response.status).toBe(200)
    expect(runtime.fetch.mock.calls.map(([url]) => url)).toEqual([
      resized, 'https://p1.music.126.net/next', 'https://y.gtimg.cn/another', 'https://imgessl.kugou.com/final',
    ])
    await Promise.all(pending)
  })

  it.each(['https://outside.test/cover', 'http://y.gtimg.cn/cover', 'https://y.gtimg.cn:443/cover'])(
    'rejects invalid redirect %s without contacting it',
    async (location) => {
      const { handler, runtime, ctx } = fixture()
      const cancel = vi.fn()
      runtime.fetch.mockResolvedValueOnce(new Response(new ReadableStream({ cancel }), {
        status: 302, headers: { Location: location },
      }))
      const response = await handler(coverRequest(), {}, ctx)
      expect(response.status).toBe(403)
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      expect(await response.json()).toEqual({ error: 'Host not allowed' })
      expect(cancel).toHaveBeenCalledOnce()
      expect(runtime.fetch).toHaveBeenCalledOnce()
    },
  )

  it('rejects a non-raster response and an oversized body with no declared length', async () => {
    const { handler, runtime, ctx } = fixture()
    const cancel = vi.fn()
    runtime.fetch
      .mockResolvedValueOnce(image('svg', { 'Content-Type': 'image/svg+xml' }))
      .mockResolvedValueOnce(image(new ReadableStream({
        start(controller) { controller.enqueue(new Uint8Array(MAX_WEB_COVER_BYTES + 1)) },
        cancel,
      })))
    const invalid = await handler(coverRequest(), {}, ctx)
    expect(invalid.status).toBe(415)
    expect(await invalid.json()).toEqual({ error: 'Unsupported image type' })
    const large = await handler(coverRequest(), {}, ctx)
    expect(large.status).toBe(413)
    expect(large.headers.get('Cache-Control')).toBe('no-store')
    expect(await large.json()).toEqual({ error: 'Image too large' })
    expect(cancel).toHaveBeenCalledOnce()
    expect(runtime.cache.put).not.toHaveBeenCalled()
  })

  it.each([
    [path, 400, 'Missing url parameter'],
    [path + '?url=invalid', 400, 'Missing url parameter'],
    [path + '?url=https%3A%2F%2Fexample.org%2Fimage', 403, 'Host not allowed'],
    [path + '?url=https%3A%2F%2Fy.gtimg.cn%3A8443%2Fimage', 400, 'Missing url parameter'],
  ])('returns a deterministic error for %s', async (url, status, error) => {
    const { handler, runtime, ctx } = fixture()
    const response = await handler(new Request(url), {}, ctx)
    expect(response.status).toBe(status)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ error })
    expect(runtime.fetch).not.toHaveBeenCalled()
  })

  it.each([403, 429, 502])('falls back to the original VPS request on CDN status %s', async (status) => {
    const { handler, runtime, ctx } = fixture()
    const request = coverRequest()
    const fallback = new Response('fallback')
    runtime.fetch.mockResolvedValueOnce(new Response(null, { status })).mockResolvedValueOnce(fallback)
    expect(await handler(request, {}, ctx)).toBe(fallback)
    expect(runtime.fetch.mock.calls[1]).toEqual([request])
    expect(runtime.cache.put).not.toHaveBeenCalled()
  })

  it('falls back after the fourth redirect response', async () => {
    const { handler, runtime, ctx } = fixture()
    const request = coverRequest()
    for (let hop = 1; hop <= 4; hop++) runtime.fetch.mockResolvedValueOnce(redirect('/hop-' + hop))
    const fallback = new Response('fallback')
    runtime.fetch.mockResolvedValueOnce(fallback)
    expect(await handler(request, {}, ctx)).toBe(fallback)
    expect(runtime.fetch).toHaveBeenCalledTimes(5)
    expect(runtime.fetch.mock.calls[4]).toEqual([request])
  })

  it('falls back to VPS on an empty 200 CDN body and returns 503 if Web fallback throws', async () => {
    const { handler, runtime, ctx } = fixture()
    const request = coverRequest()
    const fallback = new Response('fallback')
    runtime.fetch.mockResolvedValueOnce(image('')).mockResolvedValueOnce(fallback)
    expect(await handler(request, {}, ctx)).toBe(fallback)
    expect(runtime.fetch).toHaveBeenCalledTimes(2)
    expect(runtime.fetch.mock.calls[1]).toEqual([request])

    runtime.fetch.mockRejectedValueOnce(new Error('cdn down')).mockRejectedValueOnce(new Error('tunnel down'))
    const errorRes = await handler(coverRequest(), {}, ctx)
    expect(errorRes.status).toBe(503)
    expect(errorRes.headers.get('Cache-Control')).toBe('no-store')
    expect(await errorRes.json()).toEqual({ error: 'Cover proxy failed' })
  })
})

describe('mini-app cover fast mode', () => {
  it('answers a matching preflight without contacting the VPS', async () => {
    const { handler, runtime, ctx } = fixture()
    const response = await handler(new Request(path, { method: 'OPTIONS', headers: {
      Origin: origin, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'Content-Type, AUTHORIZATION',
    } }), env, ctx)
    expect(response.status).toBe(204)
    expectMappHeaders(response)
    expect(runtime.fetch).not.toHaveBeenCalled()
  })

  it.each([
    ['GET', 'Authorization, X-Extra'],
    ['POST', 'Authorization'],
    ['GET', 'Content-Type'],
  ])('passes a preflight with %s and %s through', async (method, headers) => {
    const { handler, runtime, ctx } = fixture()
    const request = new Request(path, { method: 'OPTIONS', headers: {
      Origin: origin, 'Access-Control-Request-Method': method, 'Access-Control-Request-Headers': headers,
    } })
    const upstream = new Response(null, { status: 204 })
    runtime.fetch.mockResolvedValueOnce(upstream)
    expect(await handler(request, env, ctx)).toBe(upstream)
    expect(runtime.fetch.mock.calls).toEqual([[request]])
  })

  it('returns CDN MISS then HIT with mini-app CORS and separate cached headers', async () => {
    const { handler, runtime, ctx, entries, pending } = fixture()
    runtime.fetch.mockResolvedValueOnce(image(new Uint8Array(MAPP_COVER_MAX_BYTES)))
    const miss = await handler(coverRequest(imageUrl, auth), env, ctx)
    await Promise.all(pending)
    const hit = await handler(coverRequest(imageUrl, auth), env, ctx)
    for (const [response, status] of [[miss, 'MISS'], [hit, 'HIT']] as const) {
      expect(response.status).toBe(200)
      expectMappHeaders(response)
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(response.headers.get('X-MT-Edge-Cache')).toBe(status)
      expect((await response.arrayBuffer()).byteLength).toBe(MAPP_COVER_MAX_BYTES)
    }
    expect(entries.get(cacheKey)?.headers.has('Access-Control-Allow-Origin')).toBe(false)
    expect(runtime.fetch).toHaveBeenCalledOnce()
  })

  it('rejects a mini-app MISS above 2 MiB and rejects the same cover cached by the Web handler', async () => {
    const { handler, runtime, ctx, pending } = fixture()
    const size = 2.5 * 1024 * 1024
    runtime.fetch.mockResolvedValueOnce(image(new Uint8Array(size))).mockResolvedValueOnce(image(new Uint8Array(size)))
    const miss = await handler(coverRequest(imageUrl, auth), env, ctx)
    expect(runtime.cache.put).not.toHaveBeenCalled()
    const web = await handler(coverRequest(), env, ctx)
    expect(web.status).toBe(200)
    await Promise.all(pending)
    const hit = await handler(coverRequest(imageUrl, auth), env, ctx)
    expect(runtime.fetch).toHaveBeenCalledTimes(2)
    for (const response of [miss, hit]) {
      expect(response.status).toBe(503)
      expectMappHeaders(response)
      expect(await response.json()).toEqual({ code: 'METADATA_COVER_REJECTED' })
    }
  })

  it('measures cached image bodies without a length', async () => {
    const { handler, runtime, ctx } = fixture()
    runtime.cache.match.mockResolvedValueOnce(image('image bytes'))
      .mockResolvedValueOnce(image(new Uint8Array(MAPP_COVER_MAX_BYTES + 1)))
    const hit = await handler(coverRequest(imageUrl, auth), env, ctx)
    expect(hit.headers.get('Content-Length')).toBe('11')
    expect(await hit.text()).toBe('image bytes')
    expect((await handler(coverRequest(imageUrl, auth), env, ctx)).status).toBe(503)
    expect(runtime.fetch).not.toHaveBeenCalled()
  })

  it('returns CORS errors for a disallowed host and failed origin fallback', async () => {
    const { handler, runtime, ctx } = fixture()
    const forbidden = await handler(coverRequest('https://outside.test/image', auth), env, ctx)
    expect(forbidden.status).toBe(403)
    expectMappHeaders(forbidden)
    expect(await forbidden.json()).toEqual({ code: 'METADATA_COVER_HOST_REJECTED' })
    expect(runtime.fetch).not.toHaveBeenCalled()
    runtime.fetch.mockRejectedValueOnce(new Error()).mockRejectedValueOnce(new Error())
    const request = coverRequest(imageUrl, auth)
    const failure = await handler(request, env, ctx)
    expect(runtime.fetch.mock.calls[1]).toEqual([request])
    expect(failure.status).toBe(503)
    expectMappHeaders(failure)
    expect(await failure.json()).toEqual({ code: 'METADATA_COVER_FAILED' })
  })

  it.each([
    [coverRequest(imageUrl, auth), {}],
    [coverRequest(imageUrl, { ...auth, Origin: 'https://outside.test' }), env],
    [coverRequest(imageUrl, { ...auth, Authorization: 'Basic abc' }), env],
    [coverRequest(imageUrl, { ...auth, Authorization: 'Bearer ' + 'a'.repeat(8193) }), env],
    [coverRequest(imageUrl, auth, '&mini_app_token=example'), env],
    [coverRequest(imageUrl, undefined, '&mini_app_token=example'), env],
    [coverRequest(imageUrl, auth, '&url=duplicate'), env],
    [coverRequest(imageUrl, auth, '&extra=1'), env],
    [coverRequest(imageUrl + '#', auth), env],
    [coverRequest(imageUrl + '/has whitespace', auth), env],
    [coverRequest('https://p1.music.126.net:443/cover', auth), env],
    [coverRequest(imageUrl.replace('https:', 'http:'), auth), env],
    [new Request(path + '/?url=' + encodeURIComponent(imageUrl), { headers: auth }), env],
    [new Request(path, { method: 'OPTIONS', headers: {
      Origin: origin, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'Authorization',
    } }), {}],
  ])('passes ineligible requests through unchanged (%#)', async (request, environment) => {
    const { handler, runtime, ctx } = fixture()
    const upstream = new Response('origin')
    runtime.fetch.mockResolvedValueOnce(upstream)
    expect(await handler(request, environment, ctx)).toBe(upstream)
    expect(runtime.fetch.mock.calls).toEqual([[request]])
    expect(runtime.cache.match).not.toHaveBeenCalled()
  })
})
