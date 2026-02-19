import 'dotenv/config'
import * as z from 'zod/v4'
import { TIMING } from '@music-together/shared'

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  CORS_ORIGINS: z.string().default(''),
})

const env = envSchema.parse(process.env)

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
} as const
