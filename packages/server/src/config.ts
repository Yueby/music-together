import { config as loadEnv } from 'dotenv'

loadEnv({ quiet: true })
import * as z from 'zod/v4'
import { TIMING } from '@music-together/shared'
import type { AudioQuality } from '@music-together/shared'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootPkg = JSON.parse(readFileSync(resolve(__dirname, '../../../package.json'), 'utf-8'))

const isProd = process.env.NODE_ENV === 'production'
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  CLIENT_URL: z.string().default(''),
  CORS_ORIGINS: z.string().default(''),
  IDENTITY_SECRET: isProd
    ? z.string().min(32, '生产环境必须设置至少 32 字符的 IDENTITY_SECRET')
    : z.string().min(16).default('dev-identity-secret-change-me'),
  IDENTITY_TTL_DAYS: z.coerce.number().int().positive().default(30),
  REJOIN_TTL_MS: z.coerce.number().int().positive().default(TIMING.ROOM_GRACE_PERIOD_MS),
  IDENTITY_COOKIE_SECURE: z.enum(['true', 'false']).optional(),
  AUTO_FALLBACK_ENABLED: z.enum(['true', 'false']).default('true'),
  /**
   * Highest bitrate (kbps: 128, 192, 320 or 999 = lossless) the mini-app audio endpoint serves, whatever the room asks.
   * A mini-app has to download the whole file through the server before it can play (about 1 MB/s from overseas),
   * so a 320 kbps track costs ~10 s, 192 kbps ~6 s and 128 kbps ~4 s (and the least upstream bandwidth). Rooms still stream at their own quality to the web client.
   */
  MAPP_AUDIO_MAX_BITRATE: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce
      .number()
      .refine((value) => [128, 192, 320, 999].includes(value), 'MAPP_AUDIO_MAX_BITRATE 必须是 128、192、320 或 999')
      .default(128),
  ),
  /**
   * How many mini-app audio transfers this server relays at once. Mini-apps cannot reach the music CDNs themselves
   * (their sandbox only talks to this server), so every member of a room pulls each track through here. More requests
   * than this wait in a short line; each running transfer holds one upstream connection and a few KiB of buffer.
   */
  MAPP_MAX_STREAMS: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().int().min(1).max(32).default(8),
  ),
  /** Origin of the word-by-word TTML lyric library (`<origin>/ncm-lyrics/<id>.ttml`, `<origin>/qq-lyrics/<mid>.ttml`). */
  // An empty value (`TTML_DB_BASE_URL=` in compose files) means "not set"; a malformed one still stops the boot.
  TTML_DB_BASE_URL: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.url({ protocol: /^https$/ }).default('https://amlldb.bikonoo.com'),
  ),
})

const env = envSchema.parse(process.env)
const explicitOrigins = [env.CLIENT_URL, ...env.CORS_ORIGINS.split(',')]
  .map((origin) => origin.trim())
  .filter(Boolean)

export const config = {
  version: rootPkg.version as string,
  port: env.PORT,
  isProd,
  clientUrl: explicitOrigins[0] ?? 'auto',
  explicitOrigins,
  room: {
    gracePeriodMs: TIMING.ROOM_GRACE_PERIOD_MS,
  },
  player: {
    nextDebounceMs: TIMING.PLAYER_NEXT_DEBOUNCE_MS,
  },
  identity: {
    secret: env.IDENTITY_SECRET,
    ttlDays: env.IDENTITY_TTL_DAYS,
    cookieSecure: env.IDENTITY_COOKIE_SECURE ? env.IDENTITY_COOKIE_SECURE === 'true' : null,
  },
  rejoin: {
    ttlMs: env.REJOIN_TTL_MS,
  },
  autoFallback: {
    enabled: env.AUTO_FALLBACK_ENABLED === 'true',
  },
  mapp: {
    audioMaxBitrate: env.MAPP_AUDIO_MAX_BITRATE as AudioQuality,
    maxStreams: env.MAPP_MAX_STREAMS,
  },
  ttml: {
    dbBaseUrl: env.TTML_DB_BASE_URL.replace(/\/+$/, ''),
  },
} as const
