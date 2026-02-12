import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from '@music-together/shared'
import { config } from './config.js'
import { initializeSocket } from './controllers/index.js'
import musicRoutes from './routes/music.js'
import { logger } from './utils/logger.js'
import { stop as stopSync } from './services/syncService.js'

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

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

// Socket.IO with typed events
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: config.corsOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
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
  stopSync()
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
