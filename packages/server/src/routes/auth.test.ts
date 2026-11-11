import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import express from 'express'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { identityHttpMiddleware } from '../middleware/identityHttp.js'
import { parseTrustProxy } from '../utils/trustProxy.js'
import authRoutes from './auth.js'

vi.mock('../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))

let server: Server
let base = ''

beforeAll(async () => {
  const app = express()
  // The deployment default: one reverse proxy in front, so the client address comes from X-Forwarded-For.
  app.set('trust proxy', parseTrustProxy(undefined))
  app.use('/api', identityHttpMiddleware)
  app.use('/api/auth', authRoutes)
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening))
  })
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

const bootstrap = (ip: string, cookie?: string) =>
  fetch(`${base}/api/auth/identity/bootstrap`, {
    method: 'POST',
    headers: { 'X-Forwarded-For': ip, ...(cookie ? { Cookie: cookie } : {}) },
  })

describe('POST /api/auth/identity/bootstrap rate limit', () => {
  it('hands out new identities freely at first, then answers 429 for the same client', async () => {
    const ip = '203.0.113.10'
    for (let i = 0; i < 30; i++) {
      const res = await bootstrap(ip)
      expect(res.status).toBe(204)
      expect(res.headers.get('x-identity-userid')).toBeTruthy()
    }
    const blocked = await bootstrap(ip)
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('x-identity-userid')).toBeNull()
    expect(blocked.headers.get('set-cookie')).toBeNull()
  })

  it('counts clients behind the proxy separately, not as one shared proxy address', async () => {
    for (let i = 0; i < 31; i++) await bootstrap('203.0.113.20')
    expect((await bootstrap('203.0.113.20')).status).toBe(429)
    expect((await bootstrap('203.0.113.21')).status).toBe(204)
  })

  it('does not count a visit that only renews an identity the client already has', async () => {
    const ip = '203.0.113.30'
    const first = await bootstrap(ip)
    const cookie = first.headers.getSetCookie()[0].split(';')[0]
    const userId = first.headers.get('x-identity-userid')

    for (let i = 0; i < 40; i++) {
      const res = await bootstrap(ip, cookie)
      expect(res.status).toBe(204)
      expect(res.headers.get('x-identity-userid')).toBe(userId)
    }
    // Renewals did not use up the budget for genuinely new identities.
    expect((await bootstrap(ip)).status).toBe(204)
  })
})
