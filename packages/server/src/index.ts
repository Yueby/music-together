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
import musicRoutes from './routes/music.js'
import roomRoutes from './routes/rooms.js'
import { clearAllTimers } from './services/roomLifecycleService.js'
import { logger } from './utils/logger.js'

const app = express()
const httpServer = createServer(app)

// CORS
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  }),
)
app.use(express.json())

// REST API routes
app.use('/api/music', musicRoutes)
app.use('/api/rooms', roomRoutes)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
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
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: config.corsOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket'],
})

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
  logger.info(`Accepting connections from ${config.clientUrl}`)
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
