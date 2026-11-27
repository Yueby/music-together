import express from 'express'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createCompressionMiddleware,
  createHelmetMiddleware,
  createHttpLoggerMiddleware,
  sanitizeUrlForLog,
  shouldCompressResponse,
} from './httpEnhancements.js'

const accessLogs = vi.hoisted(() => [] as Record<string, unknown>[])
vi.mock('../utils/logger.js', async () => {
  const { default: pino } = await import('pino')
  return {
    baseLogger: pino({}, { write: (line: string) => accessLogs.push(JSON.parse(line)) }),
  }
})

async function startTestServer(configure: (app: express.Express) => void) {
  const app = express()
  configure(app)
  const server = createServer(app)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  }
}

describe('httpEnhancements', () => {
  const closers: Array<() => Promise<void>> = []

  afterEach(async () => {
    while (closers.length > 0) {
      await closers.pop()!()
    }
  })

  it.each([204, 503])('logs responseTime for status %i without logging headers or tokens', async (statusCode) => {
    accessLogs.length = 0
    const srv = await startTestServer((app) => {
      app.use(createHttpLoggerMiddleware())
      app.get('/api/test', (_req, res) => res.setHeader('Set-Cookie', 'private-cookie').status(statusCode).end())
    })
    closers.push(srv.close)

    await fetch(`${srv.baseUrl}/api/test?mini_app_token=private-token`, { headers: { Cookie: 'private-request-cookie' } })

    expect(accessLogs).toHaveLength(1)
    expect(accessLogs[0]).toMatchObject({
      responseTime: expect.any(Number),
      req: { method: 'GET', url: '/api/test?mini_app_token=%5BREDACTED%5D' },
      res: { statusCode },
    })
    expect(accessLogs[0].responseTime).toBeGreaterThanOrEqual(0)
    expect(JSON.stringify(accessLogs)).not.toContain('private-')
  })

  describe('sanitizeUrlForLog', () => {
    it('redacts sensitive query parameters while preserving benign ones', () => {
      const result = sanitizeUrlForLog(
        '/api/mapp/audio?roomId=ABC123&mini_app_token=eyJhbGciOi&cookie=MUSIC_U%3Dsecret&source=netease',
      )
      expect(result).toContain('/api/mapp/audio?')
      expect(result).toContain('roomId=ABC123')
      expect(result).toContain('source=netease')
      expect(result).not.toContain('eyJhbGciOi')
      expect(result).not.toContain('MUSIC_U')
      expect(result).toContain('mini_app_token=%5BREDACTED%5D')
      expect(result).toContain('cookie=%5BREDACTED%5D')
    })

    it('returns paths without query strings untouched', () => {
      expect(sanitizeUrlForLog('/api/rooms/ABCD12/check')).toBe('/api/rooms/ABCD12/check')
      expect(sanitizeUrlForLog(undefined)).toBe('/')
    })

    it('redacts a cover URL that may contain embedded credentials', () => {
      const url = '/api/music/cover-proxy?url=' + encodeURIComponent('https://user:password@p1.music.126.net/a.png')
      expect(sanitizeUrlForLog(url)).toBe('/api/music/cover-proxy?url=%5BREDACTED%5D')
    })
  })

  describe('helmet & compression middleware', () => {
    it('sets security headers, hides X-Powered-By, and keeps cross-origin CORP', async () => {
      const srv = await startTestServer((app) => {
        app.use(createHelmetMiddleware())
        app.use(createCompressionMiddleware())
        app.get('/api/test', (_req, res) => {
          res.json({ payload: 'x'.repeat(2500) })
        })
      })
      closers.push(srv.close)

      const res = await fetch(`${srv.baseUrl}/api/test`, {
        headers: { 'Accept-Encoding': 'gzip' },
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('x-powered-by')).toBeNull()
      expect(res.headers.get('x-content-type-options')).toBe('nosniff')
      expect(res.headers.get('cross-origin-resource-policy')).toBe('cross-origin')
      expect(res.headers.get('content-security-policy')).toBeNull()
      expect(res.headers.get('strict-transport-security')).toMatch(/^max-age=\d+$/)
      // Compression active for >1KiB JSON responses
      expect(res.headers.get('vary')).toMatch(/accept-encoding/i)
    })

    it('skips compression for binary audio/cover proxy routes and audio/image content types', () => {
      const fakeRes = (contentType?: string) =>
        ({
          getHeader: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : undefined),
        }) as unknown as express.Response

      const fakeReq = (urlPath: string, headers: Record<string, string> = {}) =>
        ({ path: urlPath, url: urlPath, headers }) as unknown as express.Request

      expect(shouldCompressResponse(fakeReq('/api/mapp/audio'), fakeRes('application/octet-stream'))).toBe(false)
      expect(shouldCompressResponse(fakeReq('/api/mapp/cover'), fakeRes('image/jpeg'))).toBe(false)
      expect(shouldCompressResponse(fakeReq('/api/music/cover-proxy'), fakeRes('image/webp'))).toBe(false)
      expect(shouldCompressResponse(fakeReq('/api/other'), fakeRes('audio/mpeg'))).toBe(false)
      expect(
        shouldCompressResponse(fakeReq('/api/music/lyric', { 'x-no-compression': '1' }), fakeRes('application/json')),
      ).toBe(false)
      expect(shouldCompressResponse(fakeReq('/api/music/lyric'), fakeRes('application/json'))).toBe(true)
    })
  })
})
