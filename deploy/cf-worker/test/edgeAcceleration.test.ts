import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAPP_COVER_MAX_BYTES } from '../../../packages/shared/src/mediaContracts.js'
import { fixture } from './runtime.js'
import { isPublicMetadataPath } from '../src/handlers/publicMetadata.js'

const site = 'https://mt.agou.mom'
const origin = 'https://linux.do'
const env = { ALLOWED_MAPP_ORIGIN: origin }
const audio = '/api/mapp/audio'
const lyric = '/api/music/lyric'
const ttml = '/api/music/ttml'
const cover = '/api/music/cover-proxy'
const coverUrl = site + cover + '?url=' + encodeURIComponent('https://p1.music.126.net/cover')

function preflight(path: string, method: string | null, requested: string | null, from = origin) {
  const headers = new Headers({ Origin: from })
  if (method !== null) headers.set('Access-Control-Request-Method', method)
  if (requested !== null) headers.set('Access-Control-Request-Headers', requested)
  return new Request(site + path, { method: 'OPTIONS', headers })
}

afterEach(() => vi.restoreAllMocks())

describe('edge preflights', () => {
  it.each([
    [audio, null, null],
    [audio, 'GET', 'Content-Type'],
    [audio, 'GET', 'Authorization, content-type'],
    [lyric, 'GET', 'Authorization'],
    [ttml, 'GET', 'Content-Type, AUTHORIZATION'],
  ])('answers %s for method %s and headers %s', async (path, method, requested) => {
    const { handler, runtime, ctx } = fixture()
    const response = await handler(preflight(path, method, requested), env, ctx)
    expect(response.status).toBe(204)
    expect(response.body).toBeNull()
    expect(Object.fromEntries(response.headers)).toEqual({
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'Authorization, Content-Type',
      ...(path === audio && {
        'access-control-expose-headers': 'Content-Length, Content-Type, Content-Encoding, Server-Timing',
        'timing-allow-origin': origin,
      }),
      'access-control-max-age': '86400',
      'cache-control': 'no-store',
      'vary': 'Origin',
      'x-mt-edge-preflight': 'HIT',
    })
    expect(runtime.fetch).not.toHaveBeenCalled()
    expect(runtime.cache.match).not.toHaveBeenCalled()
  })

  it.each([
    [preflight(audio, 'POST', 'Authorization'), env],
    [preflight(audio, 'GET', 'Authorization, Range'), env],
    [preflight(audio, 'GET', 'Authorization', 'https://elsewhere.test'), env],
    [preflight(audio, 'GET', 'Authorization'), {}],
    [preflight(audio, 'GET', 'Authorization'), { ...env, ENABLE_MAPP_AUDIO: 'false' }],
    [preflight(lyric, null, 'Authorization'), env],
    [preflight(lyric, 'GET', null), env],
    [preflight(lyric, 'GET', 'Content-Type'), env],
    [preflight(lyric, 'GET', 'Authorization, Cookie'), env],
    [preflight(lyric, 'GET', 'Authorization', 'https://elsewhere.test'), env],
    [preflight(lyric, 'GET', 'Authorization'), {}],
    [preflight(lyric, 'GET', 'Authorization'), { ...env, ENABLE_PUBLIC_METADATA_CACHE: 'false' }],
    [preflight('/api/music/playlist/mine', 'GET', 'Authorization'), env],
    [new Request(site + lyric, { headers: { Origin: origin, Authorization: 'Bearer test' } }), env],
  ])('passes ineligible requests through without caching (%#)', async (request, environment) => {
    const { handler, runtime, ctx } = fixture()
    const upstream = new Response(null, { status: 403 })
    runtime.fetch.mockResolvedValueOnce(upstream)
    const response = await handler(request, environment, ctx)
    expect(response.status).toBe(403)
    const bypassesMetadataCache = environment.ENABLE_PUBLIC_METADATA_CACHE !== 'false' &&
      isPublicMetadataPath(new URL(request.url).pathname)
    expect(response.headers.get('Server-Timing')).toBe(bypassesMetadataCache ? 'edge;desc="BYPASS"' : null)
    expect(runtime.fetch.mock.calls).toEqual([[request]])
    expect(runtime.cache.match).not.toHaveBeenCalled()
  })

  it('advertises the same max age for a cover preflight', async () => {
    const { handler, runtime, ctx } = fixture()
    const response = await handler(preflight(cover, 'GET', 'Authorization'), env, ctx)
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Max-Age')).toBe('86400')
    expect(runtime.fetch).not.toHaveBeenCalled()
  })
})

describe('metadata coalescing and stale refresh', () => {
  it.each([lyric, ttml])('shares a cold read for %s with independently readable bodies', async (path) => {
    const { handler, runtime, ctx, pending } = fixture()
    const upstream = Promise.withResolvers<Response>()
    runtime.fetch.mockReturnValueOnce(upstream.promise)
    const reads = ['?id=1&source=kugou', '?source=kugou&id=1', '?id=1&source=kugou']
      .map((query) => handler(new Request(site + path + query), {}, ctx))
    await vi.waitFor(() => expect(runtime.fetch).toHaveBeenCalledOnce())
    upstream.resolve(Response.json({ lines: ['one'] }))
    const responses = await Promise.all(reads)
    expect(new Set(responses).size).toBe(reads.length)
    expect(await Promise.all(responses.map((response) => response.json()))).toEqual(
      reads.map(() => ({ lines: ['one'] })),
    )
    await Promise.all(pending)
    expect(runtime.fetch).toHaveBeenCalledOnce()
    expect(runtime.cache.put).toHaveBeenCalledOnce()
  })

  it('shares an origin failure and allows the next cold read to retry', async () => {
    const { handler, runtime, ctx, pending } = fixture()
    const upstream = Promise.withResolvers<Response>()
    const request = new Request(site + lyric)
    runtime.fetch.mockReturnValueOnce(upstream.promise).mockResolvedValueOnce(Response.json({ lyric: 'new' }))
    const reads = [handler(request, {}, ctx), handler(request, {}, ctx)]
    await vi.waitFor(() => expect(runtime.fetch).toHaveBeenCalledOnce())
    upstream.reject(new Error('origin down'))
    for (const response of await Promise.all(reads)) {
      expect(response.status).toBe(503)
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      expect(await response.json()).toEqual({ error: 'Origin unavailable' })
    }
    expect(runtime.fetch).toHaveBeenCalledOnce()
    expect(runtime.cache.put).not.toHaveBeenCalled()
    expect(await (await handler(request, {}, ctx)).json()).toEqual({ lyric: 'new' })
    await Promise.all(pending)
    expect(runtime.fetch).toHaveBeenCalledTimes(2)
  })

  it('serves fresh and stale entries, then updates the cache with one background refresh', async () => {
    const { handler, runtime, ctx, pending, entries } = fixture()
    const now = 1_800_000_000
    const ttl = 1_800
    const time = vi.spyOn(Date, 'now').mockReturnValue(now * 1000)
    const request = new Request(site + lyric)
    runtime.fetch.mockResolvedValueOnce(Response.json({ lyric: 'old' }))
    await handler(request, {}, ctx)
    await Promise.all(pending)
    const key = site + '/__mt_edge_cache/meta' + lyric
    const stored = entries.get(key)!
    expect(stored.headers.get('Cache-Control')).toBe('public, s-maxage=3600, max-age=3600')
    expect(stored.headers.get('X-MT-Edge-TTL')).toBe(String(ttl))
    expect(stored.headers.get('X-MT-Edge-Fresh-Until')).toBe(String(now + ttl))

    time.mockReturnValue((now + ttl - 1) * 1000)
    const fresh = await handler(request, {}, ctx)
    expect(fresh.headers.get('X-MT-Edge-Cache')).toBe('HIT')
    expect(fresh.headers.get('Cache-Control')).toBe('public, max-age=1')
    expect(fresh.headers.has('X-MT-Edge-Fresh-Until')).toBe(false)
    time.mockReturnValue((now + ttl) * 1000)
    const boundary = await handler(request, {}, ctx)
    expect(boundary.headers.get('X-MT-Edge-Cache')).toBe('HIT')
    expect(boundary.headers.get('Cache-Control')).toBe('public, max-age=0')
    expect(runtime.fetch).toHaveBeenCalledOnce()

    time.mockReturnValue((now + ttl + 1) * 1000)
    const upstream = Promise.withResolvers<Response>()
    runtime.fetch.mockReturnValueOnce(upstream.promise)
    const conditional = new Request(request, { headers: { 'If-None-Match': '"old"' } })
    const stale = await Promise.all([conditional, request, request].map((req) => handler(req, {}, ctx)))
    for (const response of stale) {
      expect(response.headers.get('X-MT-Edge-Cache')).toBe('STALE')
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=30')
      expect(response.headers.has('X-MT-Edge-TTL')).toBe(false)
      expect(response.headers.has('X-MT-Edge-Fresh-Until')).toBe(false)
      expect(await response.json()).toEqual({ lyric: 'old' })
    }
    expect(runtime.fetch).toHaveBeenCalledTimes(2)
    expect(new Headers(runtime.fetch.mock.calls[1][1]?.headers).has('If-None-Match')).toBe(false)
    expect(ctx.waitUntil).toHaveBeenCalledTimes(2)
    expect(runtime.cache.put).toHaveBeenCalledOnce()

    upstream.resolve(Response.json({ lyric: 'new' }))
    await Promise.all(pending)
    const refreshed = await handler(request, {}, ctx)
    expect(refreshed.headers.get('X-MT-Edge-Cache')).toBe('HIT')
    expect(refreshed.headers.get('Cache-Control')).toBe('public, max-age=1800')
    expect(await refreshed.json()).toEqual({ lyric: 'new' })
    expect(runtime.cache.put).toHaveBeenCalledTimes(2)
    expect(runtime.fetch).toHaveBeenCalledTimes(2)
  })

  it('keeps stale data through an origin failure and retries on the next request', async () => {
    const { handler, runtime, ctx, pending } = fixture()
    const now = 1_800_000_000_000
    const time = vi.spyOn(Date, 'now').mockReturnValue(now)
    const request = new Request(site + lyric)
    runtime.fetch.mockResolvedValueOnce(Response.json({ lyric: 'old' }))
      .mockRejectedValueOnce(new Error('origin down'))
      .mockResolvedValueOnce(Response.json({ lyric: 'new' }))
    await handler(request, {}, ctx)
    await Promise.all(pending)
    time.mockReturnValue(now + 1_801_000)
    expect(await (await handler(request, {}, ctx)).json()).toEqual({ lyric: 'old' })
    await Promise.all(pending)
    expect(runtime.cache.put).toHaveBeenCalledOnce()
    expect(await (await handler(request, {}, ctx)).json()).toEqual({ lyric: 'old' })
    await Promise.all(pending)
    expect(await (await handler(request, {}, ctx)).json()).toEqual({ lyric: 'new' })
  })
})

describe('cover coalescing', () => {
  it('shares one cold CDN read across Web and mini-app clients', async () => {
    const { handler, runtime, ctx, pending } = fixture()
    const upstream = Promise.withResolvers<Response>()
    runtime.fetch.mockReturnValueOnce(upstream.promise)
    const miniApp = { headers: { Origin: origin, Authorization: 'Bearer test' } }
    const reads = [miniApp, undefined, miniApp].map((init) => handler(new Request(coverUrl, init), env, ctx))
    await vi.waitFor(() => expect(runtime.fetch).toHaveBeenCalledOnce())
    upstream.resolve(new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } }))
    const responses = await Promise.all(reads)
    expect(responses.map((response) => response.headers.get('Access-Control-Allow-Origin'))).toEqual([origin, '*', origin])
    for (const response of responses) {
      expect(response.headers.get('X-MT-Edge-Cache')).toBe('MISS')
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
    }
    await Promise.all(pending)
    expect(runtime.fetch).toHaveBeenCalledOnce()
    expect(runtime.cache.put).toHaveBeenCalledOnce()
  })

  it('lets a Web request retry when a mini-app read hits its smaller limit', async () => {
    const { handler, runtime, ctx, pending } = fixture()
    const upstream = Promise.withResolvers<Response>()
    const type = { 'Content-Type': 'image/png' }
    const body = new Uint8Array(MAPP_COVER_MAX_BYTES + 1)
    runtime.fetch.mockReturnValueOnce(upstream.promise).mockResolvedValueOnce(new Response(body, { headers: type }))
    const auth = { headers: { Origin: origin, Authorization: 'Bearer test' } }
    const miniApp = handler(new Request(coverUrl, auth), env, ctx)
    const web = handler(new Request(coverUrl), env, ctx)
    await vi.waitFor(() => expect(runtime.fetch).toHaveBeenCalledOnce())
    upstream.resolve(new Response(body, { headers: type }))
    expect((await miniApp).status).toBe(503)
    expect((await (await web).arrayBuffer()).byteLength).toBe(body.byteLength)
    await Promise.all(pending)
    expect(runtime.fetch).toHaveBeenCalledTimes(2)
    expect(runtime.cache.put).toHaveBeenCalledOnce()
  })

  it('allows later edge reads after a shared CDN failure', async () => {
    const { handler, runtime, ctx, pending } = fixture()
    const upstream = Promise.withResolvers<Response>()
    runtime.fetch.mockReturnValueOnce(upstream.promise).mockImplementation(async () => new Response('origin'))
    const reads = [new Request(coverUrl), new Request(coverUrl)].map((request) => handler(request, {}, ctx))
    await vi.waitFor(() => expect(runtime.fetch).toHaveBeenCalledOnce())
    upstream.reject(new Error('CDN down'))
    for (const response of await Promise.all(reads)) expect(await response.text()).toBe('origin')
    runtime.fetch.mockResolvedValueOnce(new Response('image', { headers: { 'Content-Type': 'image/png' } }))
    expect(await (await handler(new Request(coverUrl), {}, ctx)).text()).toBe('image')
    await Promise.all(pending)
    expect(runtime.fetch).toHaveBeenCalledTimes(4)
    expect(runtime.cache.put).toHaveBeenCalledOnce()
  })
})
