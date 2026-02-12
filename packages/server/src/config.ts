import 'dotenv/config'
import { TIMING } from '@music-together/shared'

function safePort(raw: string | undefined, fallback: number): number {
  const n = parseInt(raw || '', 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export const config = {
  port: safePort(process.env.PORT, 3001),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  corsOrigins: [
    process.env.CLIENT_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    ...(process.env.CORS_ORIGINS || '').split(',').filter(Boolean),
  ] as string[],
  sync: {
    broadcastIntervalMs: TIMING.SYNC_BROADCAST_INTERVAL_MS,
  },
  room: {
    gracePeriodMs: TIMING.ROOM_GRACE_PERIOD_MS,
  },
  player: {
    nextDebounceMs: TIMING.PLAYER_NEXT_DEBOUNCE_MS,
  },
} as const
