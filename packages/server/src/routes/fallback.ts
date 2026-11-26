import express, { type Express } from 'express'
import { existsSync } from 'node:fs'
import path from 'node:path'

const pwaFiles = new Set(['sw.js', 'registerSW.js', 'manifest.webmanifest'])

/** Mount after all API routes. Returns whether the client build is available. */
export function mountFallbackRoutes(app: Express, clientDist: string): boolean {
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  const indexHtml = path.join(clientDist, 'index.html')
  const hasClient = existsSync(indexHtml)
  if (hasClient) {
    app.use('/assets', express.static(path.join(clientDist, 'assets'), { maxAge: '1y', immutable: true }))
  }
  app.use('/assets', (_req, res) => {
    res.status(404).end()
  })
  if (!hasClient) return false

  const indexCacheControl = 'no-cache, must-revalidate'
  app.use(
    express.static(clientDist, {
      maxAge: '1h',
      setHeaders: (res, filePath) => {
        const file = path.basename(filePath)
        if (file === 'index.html') res.setHeader('Cache-Control', indexCacheControl)
        else if (pwaFiles.has(file)) res.setHeader('Cache-Control', 'no-cache')
      },
    }),
  )
  app.get('/{*splat}', (_req, res) => {
    res.setHeader('Cache-Control', indexCacheControl)
    res.sendFile('index.html', { root: clientDist })
  })
  return true
}
