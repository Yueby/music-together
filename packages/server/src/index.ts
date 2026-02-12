import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { initializeSocket } from './socket/index.js'
import musicRoutes from './routes/music.js'
import { log } from './utils/logger.js'

const PORT = parseInt(process.env.PORT || '3001', 10)
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'
const CORS_ORIGINS = [CLIENT_URL, 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175']

const app = express()
const httpServer = createServer(app)

// CORS
app.use(cors({
  origin: CORS_ORIGINS,
  credentials: true,
}))
app.use(express.json())

// REST API routes
app.use('/api/music', musicRoutes)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

// Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
})

initializeSocket(io)

httpServer.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ 端口 ${PORT} 已被占用！`)
    console.error(`   请先终止占用该端口的进程，或在 .env 中修改 PORT 值。\n`)
    process.exit(1)
  }
  throw err
})

httpServer.listen(PORT, () => {
  log(`Server running on http://localhost:${PORT}`)
  log(`Accepting connections from ${CLIENT_URL}`)
})
