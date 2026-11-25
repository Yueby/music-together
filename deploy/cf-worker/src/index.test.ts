import { expect, it, vi } from 'vitest'
import { fixture } from '../test/runtime.js'
import worker from './index.js'

const zone = 'https://mt.agou.mom'

it.each([
  ['/api/mapp/audio', 'ENABLE_MAPP_AUDIO', 'false'],
  ['/api/music/cover-proxy', 'ENABLE_COVER_PROXY', 'false'],
  ['/api/music/search', 'ENABLE_PUBLIC_METADATA_CACHE', 'false'],
  ['/api/music/artist/albums', 'ENABLE_PUBLIC_METADATA_CACHE', '0'],
])('passes %s through when %s is %s', async (path, flag, value) => {
  const { handler, runtime, ctx } = fixture()
  const request = new Request(zone + path)
  const origin = new Response('origin')
  runtime.fetch.mockResolvedValueOnce(origin)
  expect(await handler(request, { [flag]: value, MAPP_RELAY_SECRET: 'example' }, ctx)).toBe(origin)
  expect(runtime.fetch.mock.calls).toEqual([[request]])
  expect(runtime.cache.match).not.toHaveBeenCalled()
})

it('uses workerd caches.default when no runtime is injected', async () => {
  const { runtime, ctx } = fixture()
  const request = new Request(zone + '/api/music/artist')
  runtime.cache.match.mockResolvedValueOnce(Response.json({ artist: 'cached' }))
  vi.stubGlobal('caches', { default: runtime.cache })
  try {
    const response = await worker.fetch(request, {}, ctx)
    expect(await response.json()).toEqual({ artist: 'cached' })
    expect(response.headers.get('X-MT-Edge-Cache')).toBe('HIT')
    expect(runtime.cache.match).toHaveBeenCalledWith(zone + '/__mt_edge_cache/meta/api/music/artist')
  } finally {
    vi.unstubAllGlobals()
  }
})
