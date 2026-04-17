import type { ClientToServerEvents, ServerToClientEvents } from '@music-together/shared'
import cors from 'cors'
import express from 'express'
import fs from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from 'socket.io'
import { config } from './config.js'
import { initializeSocket } from './controllers/index.js'
import { identityHttpMiddleware } from './middleware/identityHttp.js'
import { attachSocketIdentity } from './middleware/socketIdentity.js'
import type { SocketData } from './middleware/types.js'
import authRoutes from './routes/auth.js'
import musicRoutes from './routes/music.js'
import roomRoutes from './routes/rooms.js'
import { clearAllTimers } from './services/roomLifecycleService.js'
import { logger } from './utils/logger.js'

const app = express()
const httpServer = createServer(app)

// HTTP API CORS: in auto mode we allow the browser-reported origin and rely on
// the cookie / same-host socket checks for deployment safety. This keeps local
// dev (localhost) and LAN access working consistently.
app.use(
  cors({
    origin: config.explicitOrigins.length > 0
      ? config.explicitOrigins
      : (true as const),
    credentials: true,
  }),
)
app.use(express.json({ limit: '1mb' }))
app.use('/api', identityHttpMiddleware)

// REST API routes
app.use('/api/auth', authRoutes)
app.use('/api/music', musicRoutes)
app.use('/api/rooms', roomRoutes)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

// Version check (client polls on startup to detect updates)
app.get('/api/version', (_req, res) => {
  res.json({ version: config.version })
})

// --- Serve client SPA (条件挂载，仅当构建产物存在时) ---
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const clientDist = path.resolve(__dirname, '../../client/dist')
const indexHtml = path.join(clientDist, 'index.html')

if (fs.existsSync(indexHtml)) {
  // Vite 产物带 content hash -> 长缓存
  app.use(
    '/assets',
    express.static(path.join(clientDist, 'assets'), {
      maxAge: '1y',
      immutable: true,
    }),
  )
  // 其他静态文件 (favicon, manifest 等)。index.html 不缓存，确保部署后立即生效
  app.use(
    express.static(clientDist, {
      maxAge: '1h',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, must-revalidate')
        }
      },
    }),
  )
  // SPA fallback: 所有非 API 的 GET -> index.html
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate')
    res.sendFile(indexHtml)
  })
  logger.info(`Serving client SPA from ${clientDist}`)
} else {
  logger.info('Client dist not found, skipping static file serving (dev mode)')
}

// Socket.IO with typed events
const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
  cors: {
    origin: config.explicitOrigins.length > 0 ? config.explicitOrigins : true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
})

attachSocketIdentity(io)
initializeSocket(io)

httpServer.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`Port ${config.port} already in use`)
    process.exit(1)
  }
  throw err
})

httpServer.listen(config.port, () => {
  logger.info(`Server running on http://localhost:${config.port}`)
  logger.info(
    config.explicitOrigins.length > 0
      ? `Accepting connections from explicit origins: ${config.explicitOrigins.join(', ')}`
      : 'Accepting connections from all origins (auto mode)',
  )
})

// Graceful shutdown
function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`)
  clearAllTimers()
  io.close(() => {
    httpServer.close(() => {
      logger.info('Server closed')
      process.exit(0)
    })
  })
  // Force exit after 10s
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
