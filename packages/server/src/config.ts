import 'dotenv/config'
import * as z from 'zod/v4'
import { TIMING } from '@music-together/shared'

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  CORS_ORIGINS: z.string().default(''),
  IDENTITY_SECRET: z.string().min(16).default('dev-identity-secret-change-me'),
  IDENTITY_TTL_DAYS: z.coerce.number().int().positive().default(30),
  REJOIN_TTL_MS: z.coerce.number().int().positive().default(TIMING.ROOM_GRACE_PERIOD_MS),
  IDENTITY_COOKIE_SECURE: z.enum(['true', 'false']).optional(),
  AUTO_FALLBACK_ENABLED: z.enum(['true', 'false']).default('true'),
})

const env = envSchema.parse(process.env)
const isProd = process.env.NODE_ENV === 'production'

// 同域部署或开发环境：CLIENT_URL 为默认值时允许所有来源（origin: true）
// 显式设置 CLIENT_URL 时使用严格白名单
const isDefaultClientUrl = env.CLIENT_URL === 'http://localhost:5173'

export const config = {
  port: env.PORT,
  clientUrl: env.CLIENT_URL,
  corsOrigins: isDefaultClientUrl
    ? (true as const)
    : ([env.CLIENT_URL, ...env.CORS_ORIGINS.split(',').filter(Boolean)] as string[]),
  room: {
    gracePeriodMs: TIMING.ROOM_GRACE_PERIOD_MS,
  },
  player: {
    nextDebounceMs: TIMING.PLAYER_NEXT_DEBOUNCE_MS,
  },
  identity: {
    secret: env.IDENTITY_SECRET,
    ttlDays: env.IDENTITY_TTL_DAYS,
    cookieSecure: env.IDENTITY_COOKIE_SECURE ? env.IDENTITY_COOKIE_SECURE === 'true' : isProd,
  },
  rejoin: {
    ttlMs: env.REJOIN_TTL_MS,
  },
  autoFallback: {
    enabled: env.AUTO_FALLBACK_ENABLED === 'true',
  },
} as const
