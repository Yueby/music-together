import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fixture } from '../../test/runtime.js'

const zone = 'https://mt.agou.mom'
const search = zone + '/api/music/search'
const ttml = zone + '/api/music/ttml'

describe('public metadata edge cache', () => {
  beforeEach(() => { vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000) })
  afterEach(() => vi.restoreAllMocks())

  it.each([
    ['/api/music/ttml', 21_600],
    ['/api/music/lyric', 1_800],
    ['/api/music/discover/radar', 600],
    ['/api/music/artist', 300],
    ['/api/music/artist/songs', 300],
    ['/api/music/artist/albums', 300],
    ['/api/music/playlist', 300],
    ['/api/music/search', 180],
  ])('serves MISS and HIT for %s with a TTL of %s seconds', async (path, ttl) => {
    const { handler, runtime, ctx, pending } = fixture()
    runtime.fetch.mockResolvedValueOnce(Response.json({ lines: [] }))
    const miss = await handler(new Request(zone + path), {}, ctx)
    expect(miss.headers.get('X-MT-Edge-Cache')).toBe('MISS')
    expect(miss.headers.get('Cache-Control')).toBe('public, max-age=' + ttl)
    await Promise.all(pending)
    const hit = await handler(new Request(zone + path, { headers: { Origin: zone } }), {}, ctx)
    expect(hit.headers.get('X-MT-Edge-Cache')).toBe('HIT')
    expect(hit.headers.get('Cache-Control')).toBe('public, max-age=' + ttl)
    expect(await miss.json()).toEqual({ lines: [] })
    expect(await hit.json()).toEqual({ lines: [] })
    expect(runtime.fetch).toHaveBeenCalledOnce()
    expect(ctx.waitUntil).toHaveBeenCalledOnce()
  })

  it.each([
    [null, null, 600],
    [null, 'private, max-age=600', 600],
    [[{ start: 0 }], 'private, max-age=3600', 3600],
    [[{ start: 0 }], 'public, max-age=86400', 21_600],
  ])('chooses the TTML TTL for %j with %j', async (lines, cacheControl, ttl) => {
    const { handler, runtime, ctx, pending } = fixture()
    const headers = cacheControl ? { 'Cache-Control': cacheControl } : undefined
    runtime.fetch.mockResolvedValueOnce(Response.json({ lines }, { headers }))
    const request = new Request(ttml)
    const miss = await handler(request, {}, ctx)
    expect(await miss.json()).toEqual({ lines })
    await Promise.all(pending)
    const hit = await handler(request, {}, ctx)
    expect(hit.headers.get('X-MT-Edge-Cache')).toBe('HIT')
    expect(hit.headers.get('Cache-Control')).toBe('public, max-age=' + ttl)
  })

  it.each([
    [200, 'private, no-store'],
    [200, 'public, no-cache'],
    [200, 'public, MAX-AGE="0"'],
    [503, 'public, max-age=300'],
    [302, 'public, max-age=300'],
  ])('keeps the origin cache policy and avoids cache writes for status %s and %s', async (status, cacheControl) => {
    const { handler, runtime, ctx, pending } = fixture()
    runtime.fetch.mockResolvedValueOnce(Response.json({ lines: null }, { status, headers: {
      'Cache-Control': cacheControl, 'Set-Cookie': 'ignored=1',
    } }))
    const response = await handler(new Request(zone + '/api/music/lyric'), {}, ctx)
    expect(response.status).toBe(status)
    expect(response.headers.get('Cache-Control')).toBe(cacheControl)
    expect(response.headers.get('Set-Cookie')).toBeNull()
    expect(response.headers.get('X-MT-Edge-Cache')).toBe('MISS')
    expect(runtime.cache.put).not.toHaveBeenCalled()
    await Promise.all(pending)
  })

  it('canonicalizes query order and isolates origin and cache headers', async () => {
    const { handler, runtime, ctx, pending, entries } = fixture()
    const request = new Request(search + '?source=netease&query=music&foo=2&foo=1', {
      headers: { Cookie: 'ignored=1', Accept: 'application/json', Origin: zone },
    })
    runtime.fetch.mockResolvedValueOnce(Response.json({ results: [] }, { headers: {
      'Set-Cookie': 'ignored=2',
      'Access-Control-Allow-Origin': zone,
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Expose-Headers': 'X-Example',
      RateLimit: '"120-in-1min"; r=119; t=59',
      'RateLimit-Policy': '"120-in-1min"; q=120; w=60; pk=:abc:',
      Vary: 'Origin',
    } }))
    const miss = await handler(request, {}, ctx)
    const [upstreamUrl, init] = runtime.fetch.mock.calls[0]
    expect(upstreamUrl).toBe(request.url)
    expect(init?.redirect).toBe('manual')
    expect(init?.cache).toBe('no-store')
    expect(Object.fromEntries(new Headers(init?.headers))).toEqual({ accept: 'application/json', origin: zone })
    expect(miss.headers.has('Set-Cookie')).toBe(false)
    await Promise.all(pending)
    const key = zone + '/__mt_edge_cache/meta/api/music/search?foo=2&foo=1&query=music&source=netease'
    expect(Object.fromEntries(entries.get(key)!.headers)).toEqual({
      'cache-control': 'public, s-maxage=360, max-age=360',
      'content-type': 'application/json',
      'x-mt-edge-fresh-until': expect.stringMatching(/^\d+$/),
      'x-mt-edge-ttl': '180',
    })
    expect(entries.has(search + '?foo=2&foo=1&query=music&source=netease')).toBe(false)
    const hit = await handler(new Request(search + '?foo=2&query=music&foo=1&source=netease'), {}, ctx)
    expect(hit.headers.get('X-MT-Edge-Cache')).toBe('HIT')
    expect(hit.headers.get('X-MT-Edge-TTL')).toBeNull()
    expect(hit.headers.get('Cache-Control')).toBe('public, max-age=180')
    expect(hit.headers.get('Vary')).toBe('Origin, Authorization')
    expect(await hit.json()).toEqual({ results: [] })
    expect(runtime.fetch).toHaveBeenCalledOnce()
  })

  it('also strips cookies and CORS headers from a preexisting cache entry on HIT', async () => {
    const { handler, runtime, ctx } = fixture()
    runtime.cache.match.mockResolvedValueOnce(Response.json({ results: [] }, { headers: {
      'Set-Cookie': 'ignored=2',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Authorization',
      'Access-Control-Expose-Headers': 'X-Example',
    } }))
    const hit = await handler(new Request(search), {}, ctx)
    expect([...hit.headers.keys()].some((key) => key === 'set-cookie' || key.startsWith('access-control-'))).toBe(false)
    expect(hit.headers.get('X-MT-Edge-Cache')).toBe('HIT')
    expect(runtime.fetch).not.toHaveBeenCalled()
  })

  it('restores intended TTL on HIT even if Cloudflare rewrites cached Cache-Control to 14400', async () => {
    const { handler, runtime, ctx } = fixture()
    runtime.cache.match.mockResolvedValueOnce(
      Response.json({ lines: null }, {
        headers: { 'Cache-Control': 'public, max-age=14400', 'X-MT-Edge-TTL': '600' },
      }),
    )
    const hit = await handler(new Request(ttml), {}, ctx)
    expect(hit.headers.get('X-MT-Edge-Cache')).toBe('HIT')
    expect(hit.headers.get('Cache-Control')).toBe('public, max-age=600')
    expect(hit.headers.get('X-MT-Edge-TTL')).toBeNull()
  })

  it('returns a clean 503 with no-store when origin fetch throws', async () => {
    const { handler, runtime, ctx } = fixture()
    runtime.fetch.mockRejectedValueOnce(new Error('tunnel down'))
    const response = await handler(new Request(search), {}, ctx)
    expect(response.status).toBe(503)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ error: 'Origin unavailable' })
    expect(runtime.cache.put).not.toHaveBeenCalled()
  })

  it.each([
    new Request(zone + '/api/music/playlist/mine', { headers: { Cookie: 'private=1' } }),
    new Request(zone + '/api/music/playlist/'),
    new Request(zone + '/api/music/discover/daily'),
    new Request(zone + '/api/music/discover/home'),
    new Request(zone + '/api/music/url'),
    new Request(search, { headers: { Origin: 'https://linux.do', Cookie: 'untouched=1' } }),
    new Request(search, { headers: { Authorization: '', Cookie: 'untouched=1' } }),
    new Request(search + '?mini_app_token=', { headers: { Cookie: 'untouched=1' } }),
    new Request(search, { method: 'POST', body: 'unchanged' }),
    new Request(search, { method: 'OPTIONS' }),
  ])('passes excluded requests through unchanged (%#)', async (request) => {
    const { handler, runtime, ctx } = fixture()
    const origin = new Response('origin')
    runtime.fetch.mockResolvedValueOnce(origin)
    expect(await handler(request, {}, ctx)).toBe(origin)
    expect(runtime.fetch.mock.calls).toEqual([[request]])
    expect(runtime.cache.match).not.toHaveBeenCalled()
  })
})
