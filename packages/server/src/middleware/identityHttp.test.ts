import express from 'express'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import musicRoutes from '../routes/music.js'
import { issueIdentityCookie } from '../services/identityService.js'
import { musicProvider } from '../services/musicProvider.js'
import { identityHttpMiddleware } from './identityHttp.js'

vi.mock('../services/musicProvider.js', () => ({ musicProvider: { getLyric: vi.fn() } }))

describe('API identity cookies and cache headers', () => {
  const request = globalThis.fetch
  let server: Server
  let base: string
  let cookie: string

  beforeAll(async () => {
    const app = express()
    app.post('/test/identity', (req, res) => {
      issueIdentityCookie(req, res)
      res.status(204).end()
    })
    app.use('/api', identityHttpMiddleware)
    app.use('/api/music', musicRoutes)
    server = await new Promise<Server>((resolve) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener))
    })
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    const identity = await request(`${base}/test/identity`, { method: 'POST' })
    cookie = identity.headers.getSetCookie()[0].split(';')[0]
  })

  afterEach(() => vi.unstubAllGlobals())
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

  it('serves a sized, sandboxed public cover without renewing the identity cookie', async () => {
    const upstream = 'https://p1.music.126.net/identity-test.png'
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    const fetchCover = vi.fn(async () => new Response(bytes, { headers: { 'Content-Type': 'image/png' } }))
    vi.stubGlobal('fetch', fetchCover)

    for (const route of ['/api/music/cover-proxy', '/api/music/COVER-PROXY/']) {
      const response = await request(`${base}${route}?url=${encodeURIComponent(upstream)}`, { headers: { cookie } })
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('image/png')
      expect(response.headers.get('content-security-policy')).toBe("default-src 'none'; sandbox")
      expect(response.headers.get('cache-control')).toBe('public, max-age=86400')
      expect(response.headers.get('set-cookie')).toBeNull()
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
    }
    expect(fetchCover).toHaveBeenCalledExactlyOnceWith(`${upstream}?param=600y600`, expect.anything())
  })

  it.each([
    [true, 'private, max-age=1800'],
    [false, 'no-store'],
  ])('serves a Web lyric with cacheable=%s and the matching cache header', async (cacheable, cacheControl) => {
    const lyric = { lyric: '[00:01]fixture', tlyric: '', romalrc: '', yrc: '', cacheable }
    vi.mocked(musicProvider.getLyric).mockResolvedValueOnce(lyric)

    const response = await request(`${base}/api/music/lyric?source=kugou&lyricId=fixture`, { headers: { cookie } })
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe(cacheControl)
    expect(response.headers.get('set-cookie')).toMatch(/^mt_identity=/)
    expect(await response.json()).toEqual(lyric)
  })
})
