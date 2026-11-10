import { Writable } from 'node:stream'
import { readFile } from 'node:fs/promises'
import type { Request, RequestHandler, Response } from 'express'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mappRoomMediaQuerySchema } from '@music-together/shared'
import { createPlatformMediaRouter } from './platformMedia.js'
import { MediaError } from '../services/mediaSourceRequest.js'

vi.mock('../services/musicProvider.js', () => ({ musicProvider: { getStreamUrl: vi.fn() } }))
const log = vi.hoisted(() => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }))
vi.mock('../utils/logger.js', () => ({ logger: log }))
afterEach(() => vi.useRealTimers())

const origin = 'https://linux.do'
const raw = '/api/mapp/audio?roomId=ABC_-1&trackId=track'
const userId = 'mapp_' + 'a'.repeat(32)

class Reply extends Writable {
  headers: Record<string, unknown> = {}
  headersSent = false
  statusCode = 200
  payload?: unknown
  locals: Record<string, unknown> = {}
  status(value: number) {
    this.statusCode = value
    return this
  }
  setHeader(key: string, value: unknown) {
    this.headers[key.toLowerCase()] = value
    return this
  }
  removeHeader(key: string) {
    delete this.headers[key.toLowerCase()]
  }
  json(payload: unknown) {
    this.payload = payload
    this.end(JSON.stringify(payload))
    return this
  }
  _write(_chunk: Buffer, _encoding: string, callback: () => void) {
    this.headersSent = true
    callback()
  }
}

function fixture(
  changes: {
    method?: string
    raw?: string
    origin?: string
    headers?: Record<string, string>
    rateLimit?: RequestHandler
  } = {},
) {
  const headers: Record<string, string> = {
    origin,
    authorization: 'Bearer fixture-token',
    cookie: 'untrusted-web-cookie',
    ...changes.headers,
  }
  if (changes.origin !== undefined) headers.origin = changes.origin
  const req = {
    method: changes.method ?? 'GET',
    originalUrl: changes.raw ?? raw,
    // Express matches on `url` after mounting; the handler must read `originalUrl`.
    url: raw,
    headers,
    identityUserId: undefined as string | undefined,
    get: (name: string) => headers[name.toLowerCase()],
  }
  const res = new Reply()
  const verifyIdentity = vi.fn().mockResolvedValue({ userId })
  const stream = vi.fn().mockImplementation(async (_input, response) => {
    response.end('fixture audio')
  })
  const rateLimit = vi.fn<RequestHandler>((_req, _res, next) => next())
  const router = createPlatformMediaRouter({
    allowedOrigin: origin,
    verifyIdentity,
    rateLimit: changes.rateLimit ?? rateLimit,
    service: { stream },
  })
  /** Resolves when the response is finished/closed, or when the router hands the request back. */
  const run = () =>
    new Promise<'answered' | 'passed'>((resolve, reject) => {
      res.once('finish', () => resolve('answered'))
      res.once('close', () => resolve('answered'))
      router(req as unknown as Request, res as unknown as Response, (error?: unknown) =>
        error ? reject(error) : resolve('passed'),
      )
    })
  return { req, res, verifyIdentity, stream, rateLimit, run }
}

describe('unmounted roomAudio/platform router', () => {
  it.each(['/', '/health', '/api/music/search?keyword=fixture', '/api/auth/status', '/socket.io/?EIO=4'])(
    'leaves unrelated Web route %s untouched',
    async (path) => {
      const f = fixture({ origin: 'https://unrelated.example' })
      f.req.url = path
      f.req.originalUrl = path
      expect(await f.run()).toBe('passed')
      expect(f.res.headers).toEqual({})
      expect(f.verifyIdentity).not.toHaveBeenCalled()
      expect(f.stream).not.toHaveBeenCalled()
    },
  )

  it('requires a fixed HTTPS Origin', () => {
    for (const allowedOrigin of [
      'http://linux.do',
      'https://linux.do/forum',
      'https://user:pass@linux.do',
      'https://linux.do/',
    ]) {
      expect(() => createPlatformMediaRouter({ allowedOrigin, verifyIdentity: vi.fn() })).toThrow(
        'MEDIA_CONFIGURATION_REJECTED',
      )
    }
  })

  it('authenticates the exact originalUrl and never uses Host/forwarded/Cookie identity', async () => {
    const f = fixture()
    let identityAtRateLimit: unknown
    f.rateLimit.mockImplementation((req, _res, next) => {
      identityAtRateLimit = (req as Request).identityUserId
      next()
    })
    await f.run()
    expect(f.verifyIdentity).toHaveBeenCalledExactlyOnceWith({
      url: raw,
      origin,
      authorization: 'Bearer fixture-token',
      method: 'GET',
    })
    expect(identityAtRateLimit).toBe(userId)
    expect(f.stream).toHaveBeenCalledExactlyOnceWith(
      { roomId: 'ABC_-1', trackId: 'track', userId },
      f.res,
      expect.any(AbortSignal),
    )
    expect(f.res.headers).toMatchObject({
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'Authorization, Content-Type',
      'access-control-expose-headers': 'Content-Length, Content-Type, Content-Encoding',
    })
    expect(f.res.headers['access-control-allow-credentials']).toBeUndefined()
  })

  it('answers an exact GET preflight without requiring a token', async () => {
    const f = fixture({
      method: 'OPTIONS',
      raw: '/api/mapp/audio',
      headers: {
        authorization: '',
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'Authorization, Content-Type',
      },
    })
    await f.run()
    expect(f.res.statusCode).toBe(204)
    expect(f.verifyIdentity).not.toHaveBeenCalled()
    expect(f.stream).not.toHaveBeenCalled()
  })

  it.each(['Range', 'Cookie', 'X-Forwarded-Host'])('rejects unauthorized preflight header %s', async (header) => {
    const f = fixture({ method: 'OPTIONS', headers: { 'access-control-request-headers': header } })
    await f.run()
    expect(f.res.statusCode).toBe(403)
    expect(f.res.headers['access-control-allow-origin']).toBe(origin)
  })

  it.each(['HEAD', 'POST', 'PUT'])('rejects %s', async (method) => {
    const f = fixture({ method })
    await f.run()
    expect(f.res.statusCode).toBe(405)
    expect(f.verifyIdentity).not.toHaveBeenCalled()
  })

  it.each(['https://evil.test', 'null', '', 'https://linux.do/forum', 'https://linux.do,https://evil.test'])(
    'rejects Origin %# without authorizing or exposing CORS',
    async (value) => {
      const f = fixture({ origin: value })
      await f.run()
      expect(f.res.statusCode).toBe(403)
      expect(f.res.headers['access-control-allow-origin']).toBeUndefined()
      expect(f.verifyIdentity).not.toHaveBeenCalled()
    },
  )

  it.each([
    '/audio?roomId=ABC_-1&trackId=track',
    '/api/mapp/audio/?roomId=ABC_-1&trackId=track',
    '/API/mapp/audio?roomId=ABC_-1&trackId=track',
    'https://evil.test' + raw,
    '//evil.test' + raw,
    '/api/mapp/other?roomId=ABC_-1&trackId=track',
  ])('matches only the exact external path %#', async (value) => {
    const f = fixture({ raw: value })
    await f.run()
    expect(f.res.statusCode).toBe(404)
    expect(f.verifyIdentity).not.toHaveBeenCalled()
  })

  it.each([
    raw + '&roomId=ABC_-1',
    raw + '&trackId=track',
    raw + '&extra=1',
    raw + '&url=https://evil.test',
    raw.replace('roomId=ABC_-1', 'roomId=abcdef'),
    raw.replace('roomId=ABC_-1', 'roomId=ABC'),
    raw.replace('trackId=track', 'trackId='),
    raw.replace('trackId=track', 'trackId=' + 'x'.repeat(201)),
    '/api/mapp/audio',
    '/api/mapp/audio?roomId=ABC_-1',
  ])('rejects dynamic query %#', async (value) => {
    const f = fixture({ raw: value })
    await f.run()
    expect(f.res.statusCode).toBe(400)
    expect(f.verifyIdentity).not.toHaveBeenCalled()
  })

  it.each(['', 'Basic fixture'])('does not fall back to Cookie when Authorization is %#', async (authorization) => {
    const f = fixture({ headers: { authorization } })
    await f.run()
    expect(f.res.statusCode).toBe(401)
    expect(f.verifyIdentity).not.toHaveBeenCalled()
    expect(f.stream).not.toHaveBeenCalled()
  })

  it.each(['error', 'web-owner', undefined])(
    'sanitizes a bad resolver result (%s) and retains issuer CORS',
    async (result) => {
      const f = fixture()
      if (result === 'error') f.verifyIdentity.mockRejectedValue(new Error('token and headers and signed URL'))
      else f.verifyIdentity.mockResolvedValue(result === undefined ? undefined : { userId: result })
      await f.run()
      expect(f.res.statusCode).toBe(401)
      expect(f.res.payload).toEqual({ code: 'MEDIA_UNAUTHORIZED' })
      expect(f.res.headers['access-control-allow-origin']).toBe(origin)
      expect(f.stream).not.toHaveBeenCalled()
    },
  )

  it('bounds authentication to 6s and ignores a late success', async () => {
    vi.useFakeTimers()
    const f = fixture()
    let late!: (identity: { userId: string }) => void
    f.verifyIdentity.mockReturnValue(
      new Promise((resolve) => {
        late = resolve
      }),
    )
    const work = f.run()
    await vi.advanceTimersByTimeAsync(6000)
    await work
    expect(f.res.statusCode).toBe(401)
    expect(vi.getTimerCount()).toBe(0)
    late({ userId })
    await Promise.resolve()
    expect(f.stream).not.toHaveBeenCalled()
  })

  it('stops at the shared rate limiter before streaming', async () => {
    const f = fixture({
      rateLimit: (_req, res) => {
        res.status(429).json({ code: 'MEDIA_RATE_LIMIT' })
      },
    })
    await f.run()
    expect(f.res.statusCode).toBe(429)
    expect(f.stream).not.toHaveBeenCalled()
  })

  it('sanitizes service failures and clears prepared source metadata', async () => {
    const f = fixture()
    f.stream.mockImplementation(async () => {
      f.res.setHeader('Content-Length', 999)
      f.res.setHeader('Content-Type', 'audio/mpeg')
      throw new MediaError('MEDIA_SOURCE_DENIED', 403)
    })
    await f.run()
    expect(f.res.statusCode).toBe(403)
    expect(f.res.payload).toEqual({ code: 'MEDIA_SOURCE_DENIED' })
    expect(f.res.headers['content-length']).toBeUndefined()
    expect(f.res.headers['content-type']).toBeUndefined()
    expect(f.res.headers['access-control-allow-origin']).toBe(origin)
    // The failing stage is logged by its fixed code and status only.
    expect(log.warn).toHaveBeenCalledWith('Platform audio request failed', { code: 'MEDIA_SOURCE_DENIED', status: 403 })
  })

  it('does not leak unexpected service errors', async () => {
    const f = fixture()
    f.stream.mockRejectedValue(new Error('https://secret/?signed=token'))
    await f.run()
    // Upstream failures leave as 503: a 502/504 would be swallowed by Cloudflare's own error page (no CORS headers).
    expect(f.res.statusCode).toBe(503)
    expect(f.res.payload).toEqual({ code: 'MEDIA_FAILED' })
    expect(log.warn).toHaveBeenCalledWith('Platform audio request failed', { code: 'MEDIA_FAILED', status: 502 })
  })

  it.each([
    [502, 503],
    [504, 503],
    [403, 403],
    [429, 429],
  ])('sends an internal %i as %i on the wire', async (internal, wire) => {
    const f = fixture()
    f.stream.mockRejectedValue(new MediaError('MEDIA_SOURCE_TIMEOUT', internal))
    await f.run()
    expect(f.res.statusCode).toBe(wire)
    expect(f.res.headers['access-control-allow-origin']).toBe(origin)
  })

  it('cancels the service when the client disconnects', async () => {
    const f = fixture()
    let serviceSignal!: AbortSignal
    f.stream.mockImplementation(
      (_input, _response, signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          serviceSignal = signal
          signal.addEventListener('abort', () => reject(new MediaError('MEDIA_ABORTED', 499)), { once: true })
        }),
    )
    const work = f.run()
    await vi.waitFor(() => expect(serviceSignal).toBeDefined())
    f.res.destroy()
    await work
    expect(serviceSignal.aborted).toBe(true)
  })

  it('is mounted only when platform access is configured, ahead of the Web CORS/Cookie chain', async () => {
    const index = await readFile(new URL('../index.ts', import.meta.url), 'utf8')
    const music = await readFile(new URL('./music.ts', import.meta.url), 'utf8')
    const gate = index.indexOf('if (platform) {')
    const mount = index.indexOf('createPlatformMediaRouter(')
    expect(gate).toBeGreaterThan(-1)
    expect(mount).toBeGreaterThan(gate)
    expect(mount).toBeLessThan(index.indexOf('cors('))
    expect(mount).toBeLessThan(index.indexOf("app.use('/api', identityHttpMiddleware)"))
    expect(index).not.toContain('/api/mapp/audio')
    expect(music).not.toContain('verifyRoomMedia')
    // Account lookup for private playlists lives in the shared controller and is reached through the Web route.
    expect(music).toContain('getMyPlaylistPageMetadata')
  })
})

describe('strict shared query schema', () => {
  it('accepts generated six-character room IDs and bounded track identifiers only', () => {
    expect(mappRoomMediaQuerySchema.safeParse({ roomId: 'ABC_-1', trackId: 'x'.repeat(200) }).success).toBe(true)
    for (const query of [
      { roomId: ['ABC_-1', 'ABC_-1'], trackId: 'track' },
      { roomId: 'ABC_-1', trackId: ['track'] },
      { roomId: 'ABC_-1', trackId: 'track', url: 'https://evil.test' },
      { roomId: 'abc123', trackId: 'track' },
      { roomId: 'ABC_-1', trackId: '' },
    ])
      expect(mappRoomMediaQuerySchema.safeParse(query).success).toBe(false)
  })
})
