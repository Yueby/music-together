import type { Request, Response } from 'express'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { fetchCoverImage } = vi.hoisted(() => ({
  fetchCoverImage: vi.fn(),
}))

vi.mock('../services/coverProxy.js', () => ({
  fetchCoverImage,
}))
vi.mock('../services/musicProvider.js', () => ({ musicProvider: {} }))
vi.mock('../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))

import musicRouter from './music.js'

class MockReply {
  headers: Record<string, string> = {}
  headersSent = false
  statusCode = 200
  payload: unknown
  body: Buffer | undefined
  ended = false

  setHeader(key: string, value: string) {
    this.headers[key.toLowerCase()] = value
    return this
  }
  getHeader(key: string) {
    return this.headers[key.toLowerCase()]
  }
  append(key: string, value: string) {
    const lower = key.toLowerCase()
    const existing = this.headers[lower]
    this.headers[lower] = existing ? `${existing}, ${value}` : value
    return this
  }
  status(code: number) {
    this.statusCode = code
    return this
  }
  json(value: unknown) {
    this.payload = value
    return this.end()
  }
  end(chunk?: Buffer) {
    if (chunk) this.body = chunk
    this.headersSent = true
    this.ended = true
    return this
  }
}

async function runCoverProxy(query: Record<string, unknown>) {
  const req = {
    method: 'GET',
    url: '/cover-proxy',
    originalUrl: '/api/music/cover-proxy',
    query,
    headers: {},
    ip: '127.0.0.1',
    identityUserId: 'web-test-user',
  }
  const res = new MockReply()
  await new Promise<void>((resolve, reject) => {
    const check = () => (res.ended ? resolve() : setTimeout(check, 0))
    musicRouter(req as unknown as Request, res as unknown as Response, (err?: unknown) =>
      err ? reject(err) : resolve(),
    )
    check()
  })
  return res
}

describe('GET /api/music/cover-proxy cache control hardening', () => {
  afterEach(() => {
    fetchCoverImage.mockReset()
  })

  it('sets Cache-Control: no-store on missing url parameter (400)', async () => {
    const res = await runCoverProxy({})
    expect(res.statusCode).toBe(400)
    expect(res.headers['cache-control']).toBe('no-store')
  })

  it('sets Cache-Control: no-store when fetchCoverImage returns an error', async () => {
    fetchCoverImage.mockResolvedValueOnce({ ok: false, status: 403, error: 'Host not allowed', kind: 'host' })
    const res = await runCoverProxy({ url: 'https://evil.test/cover.jpg' })
    expect(res.statusCode).toBe(403)
    expect(res.headers['cache-control']).toBe('no-store')
  })

  it('sets Cache-Control: no-store when fetchCoverImage throws (504)', async () => {
    fetchCoverImage.mockRejectedValueOnce(new Error('timeout'))
    const res = await runCoverProxy({ url: 'https://p1.music.126.net/cover.jpg' })
    expect(res.statusCode).toBe(504)
    expect(res.headers['cache-control']).toBe('no-store')
  })

  it('sets public 24h Cache-Control on successful cover response', async () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47])
    fetchCoverImage.mockResolvedValueOnce({ ok: true, contentType: 'image/png', body: bytes })
    const res = await runCoverProxy({ url: 'https://p1.music.126.net/cover.jpg' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['cache-control']).toBe('public, max-age=86400')
    expect(res.headers['access-control-allow-origin']).toBe('*')
    expect(res.body).toEqual(bytes)
  })
})
