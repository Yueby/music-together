import 'dotenv/config'
import * as z from 'zod/v4'
import { TIMING } from '@music-together/shared'

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  CORS_ORIGINS: z.string().default(''),
})

const env = envSchema.parse(process.env)

export const config = {
  port: env.PORT,
  clientUrl: env.CLIENT_URL,
  corsOrigins: [
    env.CLIENT_URL,
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    ...env.CORS_ORIGINS.split(',').filter(Boolean),
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
