import express from 'express'
import { PROTOCOL_VERSION } from '@music-together/shared'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mountFallbackRoutes } from './fallback.js'
import { sendServerVersion } from './version.js'
import { config } from '../config.js'

describe('HTTP fallbacks with a client build', () => {
  const html = '<!doctype html><title>SPA fixture</title>'
  const pwaFiles = ['sw.js', 'registerSW.js', 'manifest.webmanifest']
  let clientDist: string
  let server: Server
  let base: string

  beforeAll(async () => {
    clientDist = await mkdtemp(path.join(tmpdir(), 'music-together-client-'))
    const assets = path.join(clientDist, 'assets')
    await mkdir(assets)
    await Promise.all([
      writeFile(path.join(clientDist, 'index.html'), html),
      writeFile(path.join(assets, 'app-current.js'), 'export {}'),
      ...pwaFiles.map((file) => writeFile(path.join(clientDist, file), file)),
    ])
    const app = express()
    app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
    app.get('/api/version', sendServerVersion)
    mountFallbackRoutes(app, clientDist)
    server = await new Promise<Server>((resolve) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener))
    })
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()))
    if (clientDist) await rm(clientDist, { recursive: true, force: true })
  })

  it('returns empty 404s for stale chunks and still serves current chunks', async () => {
    const missing = await fetch(`${base}/assets/app-stale.js`)
    expect(missing.status).toBe(404)
    expect(missing.headers.get('content-type')).toBeNull()
    expect(await missing.text()).toBe('')

    const current = await fetch(`${base}/assets/app-current.js`)
    expect(current.status).toBe(200)
    expect(current.headers.get('cache-control')).toContain('immutable')
    expect(await current.text()).toBe('export {}')
  })

  it.each(['GET', 'POST'])('returns a JSON 404 for an unknown API on %s', async (method) => {
    const response = await fetch(`${base}/api/unknown`, { method })
    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toMatch(/application\/json/)
    expect(await response.json()).toEqual({ error: 'Not found' })
  })

  it('preserves known API routes and revalidates direct and fallback HTML', async () => {
    const api = await fetch(`${base}/api/health`)
    expect(await api.json()).toEqual({ status: 'ok' })
    for (const route of ['/index.html', '/room/ABC123']) {
      const response = await fetch(base + route)
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe('no-cache, must-revalidate')
      expect(await response.text()).toBe(html)
    }
  })

  it('returns version, build ID and protocol from /api/version', async () => {
    const response = await fetch(`${base}/api/version`)
    expect(await response.json()).toEqual({ version: config.version, buildId: config.buildId, protocol: PROTOCOL_VERSION })
  })

  it.each(pwaFiles)('serves %s with revalidation', async (file) => {
    const response = await fetch(`${base}/${file}`)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-cache')
    expect(await response.text()).toBe(file)
  })
})
