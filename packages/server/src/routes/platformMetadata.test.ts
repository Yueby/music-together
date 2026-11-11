import { readFile } from 'node:fs/promises'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAPP_METADATA_MAX_BYTES } from '@music-together/shared'
import { createPlatformMetadataRouter } from './platformMetadata.js'
import { PlaylistAccessError } from '../controllers/musicMetadataController.js'
import { ArtistError } from '../services/artistService.js'
import { SearchError } from '../services/catalogUtils.js'
import { DiscoverError } from '../services/discoverService.js'
import { musicProvider } from '../services/musicProvider.js'

vi.mock('../services/musicProvider.js', () => ({
  musicProvider: {
    search: vi.fn().mockResolvedValue([]),
    searchAlbum: vi.fn().mockResolvedValue([]),
    searchPlaylist: vi.fn().mockResolvedValue([]),
    getLyric: vi.fn().mockResolvedValue({ lyric: '[00:01]fixture', tlyric: '', romalrc: '', yrc: '' }),
  },
}))
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

const origin = 'https://linux.do'
const raw = '/api/music/search?source=netease&keyword=fixture'
let sequence = 0
const uid = () => 'mapp_' + (++sequence).toString(16).padStart(32, '0')

/** Minimal Express response: records status, headers and the body it was given. */
class Reply {
  headers: Record<string, unknown> = {}
  headersSent = false
  statusCode = 200
  payload = ''
  bytes: Buffer | undefined
  ended = false
  locals: Record<string, unknown> = {}
  setHeader(name: string, value: unknown) {
    this.headers[name.toLowerCase()] = value
    return this
  }
  status(code: number) {
    this.statusCode = code
    return this
  }
  type(value: string) {
    return this.setHeader('Content-Type', value)
  }
  json(value: unknown) {
    return this.send(JSON.stringify(value))
  }
  send(body: string | Buffer) {
    if (typeof body === 'string') this.payload = body
    else this.bytes = body
    return this.end()
  }
  end() {
    this.headersSent = true
    this.ended = true
    return this
  }
  destroy() {
    this.ended = true
  }
  get body() {
    return JSON.parse(this.payload) as unknown
  }
}

function fixture(
  changes: {
    raw?: string
    method?: string
    headers?: Record<string, string | undefined>
    userId?: string
    defaults?: boolean
    rateLimit?: RequestHandler
  } = {},
) {
  const headers: Record<string, string | undefined> = {
    origin,
    authorization: 'Bearer fixture-token',
    cookie: 'userId=web-owner',
    ...changes.headers,
  }
  for (const key of Object.keys(headers)) if (headers[key] === undefined) delete headers[key]
  // `url` is what Express matches on after mounting; the handler must read `originalUrl`.
  const req = {
    method: changes.method ?? 'GET',
    originalUrl: changes.raw ?? raw,
    url: '/untrusted-local-url',
    headers,
    identityUserId: undefined,
  }
  const res = new Reply()
  const verifyIdentity = vi.fn().mockResolvedValue({ userId: changes.userId ?? uid() })
  const search = vi.fn().mockResolvedValue({ tracks: [], page: 1, hasMore: false })
  const lyric = vi.fn().mockResolvedValue({ lyric: '[00:01]fixture', tlyric: '', romalrc: '', yrc: '' })
  const ttml = vi.fn().mockResolvedValue({ ok: true, lines: [{ words: [{ word: 'Hello' }] }] })
  const cover = vi.fn().mockResolvedValue({ ok: true, contentType: 'image/jpeg', body: Buffer.from([1, 2, 3]) })
  const artist = vi
    .fn()
    .mockResolvedValue({ artist: { id: '1', name: 'A' }, songs: { items: [] }, albums: { items: [] } })
  const artistSongs = vi.fn().mockResolvedValue({ items: [], hasMore: false })
  const artistAlbums = vi.fn().mockResolvedValue({ items: [], hasMore: false })
  const playlist = vi.fn().mockResolvedValue({ tracks: [], total: 0, offset: 0, hasMore: false })
  const myPlaylist = vi.fn().mockResolvedValue({ tracks: [], total: 0, offset: 0, hasMore: false })
  const daily = vi.fn().mockResolvedValue({ items: [] })
  const home = vi.fn().mockResolvedValue({ playlists: [], artists: [], albums: [] })
  const radar = vi.fn().mockResolvedValue({ items: [] })
  const rateLimit = vi.fn<RequestHandler>((_req, _res, next) => next())
  const coverRateLimit = vi.fn<RequestHandler>((_req, _res, next) => next())
  const router = createPlatformMetadataRouter({
    allowedOrigin: origin,
    verifyIdentity,
    rateLimit: changes.rateLimit ?? rateLimit,
    coverRateLimit,
    ...(changes.defaults
      ? {}
      : { search, lyric, ttml, cover, artist, artistSongs, artistAlbums, playlist, myPlaylist, daily, home, radar }),
  })
  /** Resolves when the router either answers or hands the request back to the original chain. */
  const run = () =>
    new Promise<'answered' | 'passed'>((resolve, reject) => {
      const done: NextFunction = (error?: unknown) => (error ? reject(error) : resolve('passed'))
      const finish = () => (res.ended ? resolve('answered') : setTimeout(finish, 0))
      router(req as unknown as Request, res as unknown as Response, done)
      finish()
    })
  return {
    req,
    res,
    verifyIdentity,
    search,
    lyric,
    ttml,
    cover,
    artist,
    artistSongs,
    artistAlbums,
    playlist,
    myPlaylist,
    daily,
    home,
    radar,
    rateLimit,
    coverRateLimit,
    run,
  }
}

const ttmlRaw = '/api/music/ttml?source=netease&id=1234'

describe('platform catalog targets (artist pages and public playlists)', () => {
  it.each([
    ['/api/music/artist?source=netease&id=3684', 'artist', { source: 'netease', id: '3684' }],
    [
      '/api/music/artist/songs?source=netease&id=3684&offset=50&limit=50',
      'artistSongs',
      { source: 'netease', id: '3684', offset: 50, limit: 50 },
    ],
    [
      '/api/music/artist/albums?source=netease&id=3684',
      'artistAlbums',
      { source: 'netease', id: '3684', offset: 0, limit: 30 },
    ],
  ] as const)('serves %s from the shared controller with the parsed query', async (path, handler, query) => {
    const f = fixture({ raw: path })
    expect(await f.run()).toBe('answered')
    expect(f[handler]).toHaveBeenCalledExactlyOnceWith(query)
    expect(f.rateLimit).toHaveBeenCalledOnce()
    expect(f.res.statusCode).toBe(200)
  })

  it('serves a public playlist page anonymously, whatever cookie the request carries', async () => {
    const path = '/api/music/playlist?source=netease&id=42&type=album'
    const f = fixture({ raw: path })
    expect(await f.run()).toBe('answered')
    // `null`: the platform identity never selects a music account, so a private list can never leak through here.
    expect(f.playlist).toHaveBeenCalledExactlyOnceWith(
      { source: 'netease', id: '42', type: 'album', limit: 100, offset: 0, total: 0 },
      null,
    )
    expect(f.res.statusCode).toBe(200)
  })

  describe('discovery targets', () => {
    it('serves the radar list without an identity-dependent query', async () => {
      const f = fixture({ raw: '/api/music/discover/radar?source=netease' })
      expect(await f.run()).toBe('answered')
      expect(f.radar).toHaveBeenCalledExactlyOnceWith({ source: 'netease' })
      expect(f.res.statusCode).toBe(200)
    })

    it("reads today's songs for the verified platform identity only", async () => {
      const userId = 'mapp_' + 'b'.repeat(32)
      const f = fixture({ raw: '/api/music/discover/daily?source=netease&roomId=ROOM01', userId })
      expect(await f.run()).toBe('answered')
      expect(f.daily).toHaveBeenCalledExactlyOnceWith({ source: 'netease', roomId: 'ROOM01' }, userId)
    })

    it('reads the home blocks for the verified platform identity only', async () => {
      const userId = 'mapp_' + 'c'.repeat(32)
      const f = fixture({ raw: '/api/music/discover/home?source=netease&roomId=ROOM01', userId })
      expect(await f.run()).toBe('answered')
      expect(f.home).toHaveBeenCalledExactlyOnceWith({ source: 'netease', roomId: 'ROOM01' }, userId)
      expect(f.res.body).toEqual({ playlists: [], artists: [], albums: [] })
    })

    it.each([
      [new DiscoverError('DISCOVER_LOGIN_REQUIRED', 401), 401, 'METADATA_LOGIN_REQUIRED'],
      [new DiscoverError('DISCOVER_UNSUPPORTED', 400), 400, 'METADATA_UNSUPPORTED'],
      [new DiscoverError('DISCOVER_UPSTREAM', 503), 503, 'METADATA_FAILED'],
      [new PlaylistAccessError(403), 403, 'METADATA_FORBIDDEN'],
    ])('maps %# to a fixed code and status', async (error, status, code) => {
      const f = fixture({ raw: '/api/music/discover/daily?source=netease&roomId=ROOM01' })
      f.daily.mockImplementation(() => {
        throw error
      })
      expect(await f.run()).toBe('answered')
      expect(f.res.statusCode).toBe(status)
      expect(f.res.body).toEqual({ code })
    })

    it('refuses a caller-chosen identity or a missing room before any handler runs', async () => {
      for (const path of [
        '/api/music/discover/daily?source=netease',
        '/api/music/discover/daily?source=netease&roomId=ROOM01&userId=mapp_other',
      ]) {
        const f = fixture({ raw: path })
        expect(await f.run()).toBe('answered')
        expect(f.res.statusCode).toBe(400)
        expect(f.daily).not.toHaveBeenCalled()
      }
    })
  })

  describe('own playlist target', () => {
    const mine = '/api/music/playlist/mine?source=netease&id=42&roomId=ROOM01'

    it('hands the verified platform identity, not anything from the query, to the controller', async () => {
      const f = fixture({ raw: mine, userId: 'mapp_' + 'a'.repeat(32) })
      expect(await f.run()).toBe('answered')
      expect(f.myPlaylist).toHaveBeenCalledExactlyOnceWith(
        { source: 'netease', id: '42', roomId: 'ROOM01', type: 'playlist', limit: 100, offset: 0, total: 0 },
        'mapp_' + 'a'.repeat(32),
      )
      expect(f.res.statusCode).toBe(200)
    })

    it.each([
      [new PlaylistAccessError(401), 401, 'METADATA_UNAUTHORIZED'],
      [new PlaylistAccessError(403), 403, 'METADATA_FORBIDDEN'],
    ])('maps %# to a fixed code', async (error, status, code) => {
      const f = fixture({ raw: mine })
      f.myPlaylist.mockImplementation(() => {
        throw error
      })
      expect(await f.run()).toBe('answered')
      expect(f.res.statusCode).toBe(status)
      expect(f.res.body).toEqual({ code })
    })

    it('requires the room and refuses a caller-chosen identity in the query', async () => {
      for (const path of [
        '/api/music/playlist/mine?source=netease&id=42',
        mine + '&userId=mapp_someone-else',
        mine + '&cookie=MUSIC_U%3Dx',
      ]) {
        const f = fixture({ raw: path })
        expect(await f.run()).toBe('answered')
        expect(f.res.statusCode).toBe(400)
        expect(f.myPlaylist).not.toHaveBeenCalled()
      }
    })
  })

  it.each([
    ['ARTIST_UNSUPPORTED', 400, 'METADATA_UNSUPPORTED'],
    ['ARTIST_NOT_FOUND', 404, 'METADATA_NOT_FOUND'],
    ['ARTIST_UPSTREAM', 503, 'METADATA_FAILED'],
  ] as const)('maps %s to a fixed code and status', async (code, status, expected) => {
    const f = fixture({ raw: '/api/music/artist?source=netease&id=1' })
    f.artist.mockRejectedValue(new ArtistError(code, code === 'ARTIST_UPSTREAM' ? 503 : status))
    expect(await f.run()).toBe('answered')
    expect(f.res.statusCode).toBe(status)
    expect(f.res.body).toEqual({ code: expected })
  })

  it('answers a search that could not run as a failure, not as an empty result', async () => {
    const f = fixture({ raw: '/api/music/search?source=netease&keyword=a&limit=20&page=1&type=song' })
    f.search.mockRejectedValue(new SearchError())
    expect(await f.run()).toBe('answered')
    expect(f.res.statusCode).toBe(503)
    expect(f.res.body).toEqual({ code: 'METADATA_FAILED' })
  })

  it('hides unexpected catalog failures behind the generic code', async () => {
    const f = fixture({ raw: '/api/music/artist?source=netease&id=1' })
    f.artist.mockRejectedValue(new Error('cookie=secret'))
    expect(await f.run()).toBe('answered')
    expect(f.res.statusCode).toBe(503)
    expect(JSON.stringify(f.res.body)).not.toContain('secret')
  })

  it.each([
    '/api/music/playlist?source=netease&id=1&roomId=ABC123',
    '/api/music/playlist?source=netease&id=1&limit=500',
    '/api/music/artist?source=netease',
  ])('rejects %s before any handler runs', async (path) => {
    const f = fixture({ raw: path })
    expect(await f.run()).toBe('answered')
    expect(f.res.statusCode).toBe(400)
    expect(f.verifyIdentity).not.toHaveBeenCalled()
    expect(f.playlist).not.toHaveBeenCalled()
    expect(f.artist).not.toHaveBeenCalled()
  })
})

describe('platform TTML target', () => {
  it('verifies the identity, applies the music limiter and answers with the parsed lyric lines as JSON', async () => {
    const f = fixture({ raw: ttmlRaw })
    expect(await f.run()).toBe('answered')
    expect(f.verifyIdentity).toHaveBeenCalledExactlyOnceWith({
      url: ttmlRaw,
      origin,
      authorization: 'Bearer fixture-token',
      method: 'GET',
    })
    expect(f.ttml).toHaveBeenCalledExactlyOnceWith({ source: 'netease', id: '1234' })
    expect(f.rateLimit).toHaveBeenCalledOnce()
    expect(f.coverRateLimit).not.toHaveBeenCalled()
    expect(f.res.statusCode).toBe(200)
    expect(f.res.body).toEqual({ lines: [{ words: [{ word: 'Hello' }] }] })
    expect(f.res.headers).toMatchObject({
      'content-type': 'json',
      'cache-control': 'private, no-store, no-transform',
      'access-control-allow-origin': origin,
    })
  })

  it('answers a song without a library entry with 200 and null lines, not an error', async () => {
    const f = fixture({ raw: ttmlRaw })
    f.ttml.mockResolvedValue({ ok: true, lines: null })
    expect(await f.run()).toBe('answered')
    expect(f.res.statusCode).toBe(200)
    expect(f.res.body).toEqual({ lines: null })
  })

  it('answers an unavailable library with a fixed 502 code', async () => {
    const f = fixture({ raw: ttmlRaw })
    f.ttml.mockResolvedValue({ ok: false })
    expect(await f.run()).toBe('answered')
    expect(f.res.statusCode).toBe(503)
    expect(f.res.body).toEqual({ code: 'METADATA_FAILED' })
  })

  it('rejects a TTML request carrying a URL or any extra query key before touching the library', async () => {
    for (const extra of ['&url=https://evil.test/x.ttml', '&roomId=ABC123', '&id=2']) {
      const f = fixture({ raw: ttmlRaw + extra })
      expect(await f.run()).toBe('answered')
      expect(f.res.statusCode).toBe(400)
      expect(f.ttml).not.toHaveBeenCalled()
      expect(f.verifyIdentity).not.toHaveBeenCalled()
    }
  })
})

const coverImage = 'https://p1.music.126.net/a/b.jpg?param=200y200'
const coverRaw = '/api/music/cover-proxy?url=' + encodeURIComponent(coverImage)

describe('platform cover target', () => {
  it('verifies the identity, applies the cover limiter and answers with the image bytes', async () => {
    const f = fixture({ raw: coverRaw })
    expect(await f.run()).toBe('answered')
    expect(f.verifyIdentity).toHaveBeenCalledExactlyOnceWith({
      url: coverRaw,
      origin,
      authorization: 'Bearer fixture-token',
      method: 'GET',
    })
    expect(f.cover).toHaveBeenCalledExactlyOnceWith(coverImage)
    expect(f.coverRateLimit).toHaveBeenCalledOnce()
    expect(f.rateLimit).not.toHaveBeenCalled()
    expect(f.res.statusCode).toBe(200)
    expect(f.res.bytes).toEqual(Buffer.from([1, 2, 3]))
    expect(f.res.headers).toMatchObject({
      'content-type': 'image/jpeg',
      'cache-control': 'private, no-store, no-transform',
      'x-content-type-options': 'nosniff',
      'access-control-allow-origin': origin,
    })
  })

  it('keeps search on its own limiter', async () => {
    const f = fixture()
    await f.run()
    expect(f.rateLimit).toHaveBeenCalledOnce()
    expect(f.coverRateLimit).not.toHaveBeenCalled()
    expect(f.cover).not.toHaveBeenCalled()
  })

  it.each([
    [{ ok: false, status: 403, error: 'Host not allowed', kind: 'host' }, 403, 'METADATA_COVER_HOST_REJECTED'],
    [{ ok: false, status: 413, error: 'Invalid or oversized image', kind: 'invalid' }, 503, 'METADATA_COVER_REJECTED'],
    [{ ok: false, status: 404, error: 'Upstream fetch failed', kind: 'upstream' }, 503, 'METADATA_COVER_FAILED'],
    // An expired or hotlink-protected image is an upstream failure, not an allowlist problem.
    [{ ok: false, status: 403, error: 'Upstream fetch failed', kind: 'upstream' }, 503, 'METADATA_COVER_FAILED'],
  ])('maps upstream result %# to a fixed code without leaking details', async (result, status, code) => {
    const f = fixture({ raw: coverRaw })
    f.cover.mockResolvedValue(result)
    await f.run()
    expect(f.res.statusCode).toBe(status)
    expect(f.res.body).toEqual({ code })
    expect(f.res.bytes).toBeUndefined()
  })

  it('hides fetch failures behind a generic error', async () => {
    const f = fixture({ raw: coverRaw })
    f.cover.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.1:443'))
    await f.run()
    expect(f.res.statusCode).toBe(503)
    expect(f.res.body).toEqual({ code: 'METADATA_FAILED' })
  })

  it('bounds the fetch to 20s', async () => {
    vi.useFakeTimers()
    const f = fixture({ raw: coverRaw })
    f.cover.mockReturnValue(new Promise(() => {}))
    const done = f.run()
    await vi.advanceTimersByTimeAsync(20_001)
    await done
    expect(f.res.statusCode).toBe(503)
    expect(f.res.body).toEqual({ code: 'METADATA_TIMEOUT' })
  })

  it.each([
    '/api/music/cover-proxy',
    '/api/music/cover-proxy?url=http://p1.music.126.net/a.jpg',
    coverRaw + '&extra=1',
    coverRaw + '&url=' + encodeURIComponent(coverImage),
    '/api/music/cover-proxy?url=' + encodeURIComponent('https://user:pass@p1.music.126.net/a.jpg'),
  ])('rejects an invalid cover query %# before authentication', async (value) => {
    const f = fixture({ raw: value })
    await f.run()
    expect(f.res.statusCode).toBe(400)
    expect(f.verifyIdentity).not.toHaveBeenCalled()
    expect(f.cover).not.toHaveBeenCalled()
  })

  it('requires a verified platform identity', async () => {
    const f = fixture({ raw: coverRaw })
    f.verifyIdentity.mockRejectedValue(new Error('sensitive'))
    await f.run()
    expect(f.res.statusCode).toBe(401)
    expect(f.cover).not.toHaveBeenCalled()
  })

  it('leaves a normal Web cover-proxy request (no Authorization) on the original chain', async () => {
    const f = fixture({ raw: coverRaw, headers: { origin: 'https://web.example.test', authorization: undefined } })
    expect(await f.run()).toBe('passed')
    expect(f.res.headers).toEqual({})
    expect(f.verifyIdentity).not.toHaveBeenCalled()
    expect(f.cover).not.toHaveBeenCalled()
  })

  it('answers the SDK Authorization preflight for the cover path', async () => {
    const f = fixture({
      raw: '/api/music/cover-proxy',
      method: 'OPTIONS',
      headers: {
        authorization: undefined,
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'Authorization, Content-Type',
      },
    })
    await f.run()
    expect(f.res.statusCode).toBe(204)
    expect(f.res.headers['access-control-allow-origin']).toBe(origin)
    expect(f.verifyIdentity).not.toHaveBeenCalled()
  })

  describe('default fetcher (global fetch mocked, no network)', () => {
    const image = (bytes: number, headers: Record<string, string> = {}) =>
      new Response(Buffer.alloc(bytes), { headers: { 'content-type': 'image/png', ...headers } })
    afterEach(() => vi.unstubAllGlobals())

    it('returns allowed-host images up to 2 MiB', async () => {
      const upstream = vi.fn().mockResolvedValue(image(2 * 1024 * 1024))
      vi.stubGlobal('fetch', upstream)
      const f = fixture({ raw: coverRaw, defaults: true })
      await f.run()
      expect(upstream).toHaveBeenCalledOnce()
      expect(f.res.statusCode).toBe(200)
      expect(f.res.bytes?.length).toBe(2 * 1024 * 1024)
      expect(f.res.headers['content-type']).toBe('image/png')
    })

    it('rejects images above 2 MiB, declared or not', async () => {
      for (const response of [
        image(10, { 'content-length': String(2 * 1024 * 1024 + 1) }),
        image(2 * 1024 * 1024 + 1),
      ]) {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
        const f = fixture({ raw: coverRaw, defaults: true })
        await f.run()
        expect(f.res.statusCode).toBe(503)
        expect(f.res.body).toEqual({ code: 'METADATA_COVER_REJECTED' })
      }
    })

    it('refuses hosts outside the cover CDN allowlist without contacting them', async () => {
      const upstream = vi.fn()
      vi.stubGlobal('fetch', upstream)
      const f = fixture({
        raw: '/api/music/cover-proxy?url=' + encodeURIComponent('https://evil.test/a.png'),
        defaults: true,
      })
      await f.run()
      expect(f.res.statusCode).toBe(403)
      expect(f.res.body).toEqual({ code: 'METADATA_COVER_HOST_REJECTED' })
      expect(upstream).not.toHaveBeenCalled()
    })

    it('rejects a non-image upstream response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('<html>', { headers: { 'content-type': 'text/html' } })),
      )
      const f = fixture({ raw: coverRaw, defaults: true })
      await f.run()
      expect(f.res.statusCode).toBe(503)
      expect(f.res.body).toEqual({ code: 'METADATA_COVER_REJECTED' })
    })
  })
})

describe('unmounted platform metadata router', () => {
  it.each([
    '/',
    '/api/music/url?source=netease&urlId=x',
    '/api/music/cover?source=netease&picId=x',
    '/api/music/ttml/?source=netease&id=1',
    '/api/music/playlist/extra?source=netease&id=x',
    '/api/music/artist/popular?source=netease&id=1',
    '/api/rooms',
    '/api/auth/status',
    '/api/music/search/',
    '/API/music/search',
    'https://evil.test' + raw,
    '//evil.test' + raw,
    '/api/music/%73earch?source=netease&keyword=fixture',
  ])('passes unrelated or non-exact paths through untouched %#', async (path) => {
    const f = fixture({ raw: path })
    expect(await f.run()).toBe('passed')
    expect(f.res.headers).toEqual({})
    expect(f.verifyIdentity).not.toHaveBeenCalled()
    expect(f.search).not.toHaveBeenCalled()
  })

  it.each(['GET', 'POST', 'HEAD', 'OPTIONS'])(
    'leaves normal Web Cookie %s requests on the original chain without touching headers or identity',
    async (method) => {
      const f = fixture({ method, headers: { origin: 'https://web.example.test', authorization: undefined } })
      f.req.identityUserId = 'web-cookie-fixture' as never
      expect(await f.run()).toBe('passed')
      expect(f.res.headers).toEqual({})
      expect(f.req.identityUserId).toBe('web-cookie-fixture')
      expect(f.verifyIdentity).not.toHaveBeenCalled()
    },
  )

  it('keeps a normal Web preflight separate from platform Authorization preflights', async () => {
    const f = fixture({
      method: 'OPTIONS',
      headers: {
        authorization: undefined,
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'Content-Type',
      },
    })
    expect(await f.run()).toBe('passed')
    expect(f.res.headers).toEqual({})
  })

  it('requires an exact trusted HTTPS origin', () => {
    for (const allowedOrigin of ['http://linux.do', origin + '/', origin + '/forum', 'https://user:pass@linux.do']) {
      expect(() => createPlatformMetadataRouter({ allowedOrigin, verifyIdentity: vi.fn() })).toThrow()
    }
  })

  it('serves a verified platform request and never falls back to the Cookie identity', async () => {
    const userId = uid()
    const f = fixture({ userId })
    let identityAtRateLimit: unknown
    f.rateLimit.mockImplementation((req, _res, next) => {
      identityAtRateLimit = (req as Request).identityUserId
      next()
    })
    expect(await f.run()).toBe('answered')
    expect(f.verifyIdentity).toHaveBeenCalledExactlyOnceWith({
      url: raw,
      origin,
      authorization: 'Bearer fixture-token',
      method: 'GET',
    })
    expect(identityAtRateLimit).toBe(userId)
    expect(f.search).toHaveBeenCalledExactlyOnceWith({
      source: 'netease',
      keyword: 'fixture',
      limit: 20,
      page: 1,
      type: 'song',
    })
    expect(f.res.body).toEqual({ tracks: [], page: 1, hasMore: false })
    expect(f.res.headers).toMatchObject({
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'Authorization, Content-Type',
      'cache-control': 'private, no-store, no-transform',
    })
    expect(f.res.headers['access-control-allow-credentials']).toBeUndefined()
  })

  it.each(['song', 'album', 'playlist'])('reuses the shared controller for catalog %s search', async (type) => {
    const f = fixture({ raw: raw + '&type=' + type, defaults: true })
    await f.run()
    const provider =
      type === 'song'
        ? musicProvider.search
        : type === 'album'
          ? musicProvider.searchAlbum
          : musicProvider.searchPlaylist
    expect(provider).toHaveBeenCalledExactlyOnceWith('netease', 'fixture', 20, 1)
    expect(f.res.body).toEqual({ tracks: [], page: 1, hasMore: false })
  })

  it('reuses the shared lyric controller', async () => {
    const f = fixture({ raw: '/api/music/lyric?source=tencent&lyricId=fixture', defaults: true })
    await f.run()
    expect(musicProvider.getLyric).toHaveBeenCalledExactlyOnceWith('tencent', 'fixture')
    expect(f.res.body).toMatchObject({ lyric: '[00:01]fixture' })
  })

  it('answers an exact GET preflight without authentication', async () => {
    const f = fixture({
      raw: '/api/music/search',
      method: 'OPTIONS',
      headers: {
        authorization: undefined,
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'Authorization, Content-Type',
      },
    })
    await f.run()
    expect(f.res.statusCode).toBe(204)
    expect(f.res.headers['access-control-allow-origin']).toBe(origin)
    expect(f.verifyIdentity).not.toHaveBeenCalled()
  })

  it.each([
    {},
    { 'access-control-request-method': 'HEAD' },
    { 'access-control-request-method': 'GET', 'access-control-request-headers': 'Cookie' },
    { 'access-control-request-method': 'GET', 'access-control-request-headers': 'Authorization, Range' },
  ])('rejects non-approved preflight %#', async (headers) => {
    const f = fixture({ method: 'OPTIONS', headers })
    await f.run()
    expect(f.res.statusCode).toBe(403)
    expect(f.verifyIdentity).not.toHaveBeenCalled()
  })

  it.each(['HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'])('rejects %s', async (method) => {
    const f = fixture({ method })
    await f.run()
    expect(f.res.statusCode).toBe(405)
    expect(f.verifyIdentity).not.toHaveBeenCalled()
  })

  it.each(['', 'null', 'https://evil.test', origin + '/forum', origin + ',https://evil.test'])(
    'rejects Origin %# without exposing CORS',
    async (value) => {
      const f = fixture({ headers: { origin: value } })
      await f.run()
      expect(f.res.statusCode).toBe(403)
      expect(f.res.headers['access-control-allow-origin']).toBeUndefined()
      expect(f.verifyIdentity).not.toHaveBeenCalled()
    },
  )

  it.each([
    raw + '&keyword=again',
    raw + '&%6beyword=again',
    raw + '&cookie=fixture',
    raw + '&url=https://evil.test',
    raw + '&roomId=ABC123',
    raw + '&mini_app_token=fixture',
    raw + '&extra=1',
    raw.replace('fixture', '%ZZ'),
    raw + '&limit=0',
    '/api/music/search',
    '/api/music/lyric?source=netease',
    '/api/music/lyric?source=netease&lyricId=x&lyricId=y',
  ])('rejects strict query violations before authentication %#', async (value) => {
    const f = fixture({ raw: value })
    await f.run()
    expect(f.res.statusCode).toBe(400)
    expect(f.verifyIdentity).not.toHaveBeenCalled()
  })

  it('treats a misplaced mini_app_token query as a platform request instead of using the Cookie', async () => {
    const f = fixture({ raw: raw + '&mini_app_token=fixture', headers: { authorization: undefined } })
    expect(await f.run()).toBe('answered')
    expect(f.res.statusCode).toBe(400)
    expect(f.search).not.toHaveBeenCalled()
  })

  it.each(['', 'Basic fixture', 'Bearer ', 'Bearer fixture, Bearer again', 'Bearer ' + 'x'.repeat(8193)])(
    'rejects Cookie mixed with invalid Authorization %#',
    async (authorization) => {
      const f = fixture({ headers: { authorization } })
      await f.run()
      expect(f.res.statusCode).toBe(401)
      expect(f.req.identityUserId).toBeUndefined()
      expect(f.verifyIdentity).not.toHaveBeenCalled()
      expect(f.search).not.toHaveBeenCalled()
    },
  )

  it.each(['web-owner', undefined, 'error'])(
    'does not trust a bad resolver result (%s) or expose resolver errors',
    async (result) => {
      const f = fixture()
      if (result === 'error') f.verifyIdentity.mockRejectedValue(new Error('sensitive provider detail'))
      else f.verifyIdentity.mockResolvedValue(result === undefined ? undefined : { userId: result })
      await f.run()
      expect(f.res.statusCode).toBe(401)
      expect(f.res.body).toEqual({ code: 'METADATA_UNAUTHORIZED' })
      expect(f.res.headers['access-control-allow-origin']).toBe(origin)
      expect(f.search).not.toHaveBeenCalled()
    },
  )

  it('bounds authentication to 6s', async () => {
    vi.useFakeTimers()
    const f = fixture()
    f.verifyIdentity.mockReturnValue(new Promise(() => {}))
    const done = f.run()
    await vi.advanceTimersByTimeAsync(6001)
    await done
    expect(f.res.statusCode).toBe(401)
    expect(f.search).not.toHaveBeenCalled()
  })

  it('stops at the shared rate limiter before touching the provider', async () => {
    const f = fixture({
      rateLimit: (_req, res) => {
        res.status(429).json({ error: 'Too many music API requests' })
      },
    })
    await f.run()
    expect(f.res.statusCode).toBe(429)
    expect(f.search).not.toHaveBeenCalled()
  })

  it('bounds provider work to 20s', async () => {
    vi.useFakeTimers()
    const f = fixture()
    f.search.mockReturnValue(new Promise(() => {}))
    const done = f.run()
    await vi.advanceTimersByTimeAsync(20_001)
    await done
    expect(f.res.statusCode).toBe(503)
    expect(f.res.body).toEqual({ code: 'METADATA_TIMEOUT' })
  })

  it('measures UTF-8 JSON bytes, including the exact 1 MiB boundary', async () => {
    const exact = fixture()
    exact.search.mockResolvedValue('x'.repeat(MAPP_METADATA_MAX_BYTES - 2))
    await exact.run()
    expect(exact.res.statusCode).toBe(200)
    expect(Buffer.byteLength(exact.res.payload)).toBe(MAPP_METADATA_MAX_BYTES)
    const large = fixture()
    large.search.mockResolvedValue('界'.repeat(Math.ceil(MAPP_METADATA_MAX_BYTES / 3)))
    await large.run()
    expect(large.res.statusCode).toBe(503)
    expect(large.res.body).toEqual({ code: 'METADATA_RESPONSE_TOO_LARGE' })
  })

  it('sanitizes serialization and provider errors', async () => {
    for (const kind of ['provider', 'serialization']) {
      const f = fixture()
      if (kind === 'provider') f.search.mockRejectedValue(new Error('private upstream detail'))
      else {
        const cyclic: Record<string, unknown> = {}
        cyclic.self = cyclic
        f.search.mockResolvedValue(cyclic)
      }
      await f.run()
      expect(f.res.statusCode).toBe(503)
      expect(f.res.body).toEqual({ code: 'METADATA_FAILED' })
    }
  })

  it('is mounted only when platform access is configured, ahead of the Web music routes and limiter', async () => {
    const index = await readFile(new URL('../index.ts', import.meta.url), 'utf8')
    const web = await readFile(new URL('./music.ts', import.meta.url), 'utf8')
    const gate = index.indexOf('if (platform) {')
    const mount = index.indexOf('createPlatformMetadataRouter(')
    expect(gate).toBeGreaterThan(-1)
    expect(mount).toBeGreaterThan(gate)
    expect(mount).toBeLessThan(index.indexOf('cors('))
    // The router applies musicApiRateLimit itself; mounting it after `/api/music` would count requests twice.
    expect(mount).toBeLessThan(index.indexOf("'/api/music'"))
    expect(web).not.toContain('verifyMusicMetadata')
    expect(web).toContain('getMyPlaylistPageMetadata')
    expect(web).toContain('searchMusicMetadata(data)')
    expect(web).toContain('getMusicLyricMetadata(data)')
    expect(web).toContain('getMusicTtmlMetadata(data)')
  })
})
