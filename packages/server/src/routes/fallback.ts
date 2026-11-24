import express, { type Express } from 'express'
import { existsSync } from 'node:fs'
import path from 'node:path'

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
        if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', indexCacheControl)
      },
    }),
  )
  app.get('/{*splat}', (_req, res) => {
    res.setHeader('Cache-Control', indexCacheControl)
    res.sendFile('index.html', { root: clientDist })
  })
  return true
}
