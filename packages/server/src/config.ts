import { config as loadEnv } from 'dotenv'

loadEnv({ quiet: true })
import * as z from 'zod/v4'
import { MUSIC_SOURCES, PROTOCOL_VERSION, TIMING } from '@music-together/shared'
import type { AudioQuality, MusicSource, ServerHelloEvent } from '@music-together/shared'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseTrustProxy } from './utils/trustProxy.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootPkg = JSON.parse(readFileSync(resolve(__dirname, '../../../package.json'), 'utf-8'))

const isProd = process.env.NODE_ENV === 'production'
const developmentIdentitySecret = 'dev-identity-secret-change-me'
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  CLIENT_URL: z.string().default(''),
  CORS_ORIGINS: z.string().default(''),
  IDENTITY_SECRET: isProd
    ? z.string().min(32, '生产环境必须设置至少 32 字符的 IDENTITY_SECRET')
    : z.preprocess(
        (value) => (typeof value === 'string' && !value.trim() ? undefined : value),
        z.string().min(16).default(developmentIdentitySecret),
      ),
  IDENTITY_TTL_DAYS: z.coerce.number().int().positive().default(30),
  REJOIN_TTL_MS: z.coerce.number().int().positive().default(TIMING.ROOM_GRACE_PERIOD_MS),
  IDENTITY_COOKIE_SECURE: z.enum(['true', 'false']).optional(),
  AUTO_FALLBACK_ENABLED: z.enum(['true', 'false']).default('true'),
  /** Express `trust proxy` (see utils/trustProxy.ts). Default: one reverse proxy in front. */
  TRUST_PROXY: z.string().default(''),
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
   * Highest bitrate (kbps: 128, 192, 320 or 999 = lossless) used when resolving URLs for the Cloudflare Worker
   * edge audio relay (`resolve-v1`). Defaults to at least 320 kbps.
   * A 32 MiB file holds about 14 minutes at 320 kbps or about 5 minutes at a nominal 999 kbps (lossless varies).
   * Oversize files fall back to VPS relay at the direct bitrate without marking the edge degraded.
   */
  MAPP_RELAY_AUDIO_MAX_BITRATE: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce
      .number()
      .refine((value) => [128, 192, 320, 999].includes(value), 'MAPP_RELAY_AUDIO_MAX_BITRATE 必须是 128、192、320 或 999')
      .optional(),
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
  /** Optional shared secret enabling trusted Cloudflare Worker edge audio relay (`X-MT-Relay-Secret`). */
  MAPP_RELAY_SECRET: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : typeof value === 'string' ? value.trim() : value),
    z.string().min(1).optional(),
  ),
  /** Comma-separated music sources allowed to use edge relay resolution (default: all sources; `none` disables all). */
  MAPP_RELAY_SOURCES: z.preprocess(
    (value) => {
      if (value === undefined || value === null) return [...MUSIC_SOURCES]
      if (typeof value !== 'string') return value
      const trimmed = value.trim()
      if (!trimmed) return [...MUSIC_SOURCES]
      if (trimmed.toLowerCase() === 'none') return []
      const items = trimmed
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
      if (items.length === 0) return ['']
      return Array.from(new Set(items))
    },
    z.array(z.enum(MUSIC_SOURCES)),
  ),
  /** Origin of the word-by-word TTML lyric library (`<origin>/ncm-lyrics/<id>.ttml`, `<origin>/qq-lyrics/<mid>.ttml`). */
  // An empty value (`TTML_DB_BASE_URL=` in compose files) means "not set"; a malformed one still stops the boot.
  TTML_DB_BASE_URL: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.url({ protocol: /^https$/ }).default('https://amlldb.bikonoo.com'),
  ),
  /** Enable dynamic capacity & admission queue protection. */
  CAPACITY_ENABLED: z.enum(['true', 'false']).default('true'),
  /** Minimum dynamic capacity ceiling in weighted load units (never shrinks below this). */
  CAPACITY_MIN_UNITS: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().int().min(1).max(2000).default(12),
  ),
  /** Maximum dynamic capacity ceiling in weighted load units (hard upper bound). */
  CAPACITY_MAX_UNITS: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().int().min(1).max(5000).default(300),
  ),
  /** Optional explicit initial baseline in weighted load units (defaults to container cgroup-derived estimate). */
  CAPACITY_BASE_UNITS: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().int().min(1).max(5000).optional(),
  ),
  /** Weighted load cost of a mini-app user within the concurrent relay budget (defaults to 1 when full edge relay is configured, else 3). */
  CAPACITY_MAPP_WEIGHT: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().min(1).max(10).optional(),
  ),
  CAPACITY_MAPP_ROOM_BASE: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().int().min(1).max(2000).optional(),
  ),
  /** Maximum number of users allowed in the admission waiting queue. */
  CAPACITY_MAX_QUEUE: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().int().min(0).max(1000).default(100),
  ),
  /** Outer hard cap on total concurrent Socket.IO connections (protects FD/memory against idle socket floods). */
  CAPACITY_MAX_SOCKETS: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().int().min(20).max(10000).default(500),
  ),
  /** Optional memory ceiling (MiB) override for non-cgroup hosts; Docker containers auto-read cgroup memory limits. */
  CAPACITY_MEMORY_LIMIT_MB: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().int().min(64).max(131072).optional(),
  ),
})

const env = envSchema.parse(process.env)
const edgeRelayEnabled = Boolean(env.MAPP_RELAY_SECRET) && env.MAPP_RELAY_SOURCES.length === MUSIC_SOURCES.length
const relayAudioMaxBitrate = (env.MAPP_RELAY_AUDIO_MAX_BITRATE ?? Math.max(env.MAPP_AUDIO_MAX_BITRATE, 320)) as AudioQuality
const explicitOrigins = [env.CLIENT_URL, ...env.CORS_ORIGINS.split(',')]
  .map((origin) => origin.trim())
  .filter(Boolean)

export const config = {
  version: rootPkg.version as string,
  buildId: process.env.BUILD_ID?.trim() || 'dev',
  stateDir: process.env.STATE_DIR?.trim() || '',
  roomSnapshot: {
    enabled: process.env.ROOM_SNAPSHOT_ENABLED !== 'false',
    maxAgeMs: parseInt(process.env.ROOM_SNAPSHOT_MAX_AGE_MS ?? '', 10) || 10 * 60_000,
    continuityMs: parseInt(process.env.ROOM_RESTORE_CONTINUITY_MS ?? '', 10) || 120_000,
    rejoinWindowMs: parseInt(process.env.RESTORE_REJOIN_WINDOW_MS ?? '', 10) || TIMING.RESTORE_REJOIN_WINDOW_MS,
    intervalMs: 15_000,
  },
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
    hasPersistentSecret: Boolean(env.IDENTITY_SECRET.trim()) && env.IDENTITY_SECRET !== developmentIdentitySecret,
    ttlDays: env.IDENTITY_TTL_DAYS,
    cookieSecure: env.IDENTITY_COOKIE_SECURE ? env.IDENTITY_COOKIE_SECURE === 'true' : null,
  },
  rejoin: {
    ttlMs: env.REJOIN_TTL_MS,
  },
  trustProxy: parseTrustProxy(env.TRUST_PROXY),
  autoFallback: {
    enabled: env.AUTO_FALLBACK_ENABLED === 'true',
  },
  mapp: {
    audioMaxBitrate: env.MAPP_AUDIO_MAX_BITRATE as AudioQuality,
    relayAudioMaxBitrate,
    maxStreams: env.MAPP_MAX_STREAMS,
    relaySecret: env.MAPP_RELAY_SECRET,
    relaySources: env.MAPP_RELAY_SOURCES as readonly MusicSource[],
    edgeRelayEnabled,
  },
  ttml: {
    dbBaseUrl: env.TTML_DB_BASE_URL.replace(/\/+$/, ''),
  },
  capacity: {
    enabled: env.CAPACITY_ENABLED === 'true',
    minUnits: env.CAPACITY_MIN_UNITS,
    maxUnits: Math.max(env.CAPACITY_MIN_UNITS, env.CAPACITY_MAX_UNITS),
    baseUnits: env.CAPACITY_BASE_UNITS,
    mappWeight: env.CAPACITY_MAPP_WEIGHT ?? (edgeRelayEnabled ? 1 : 3),
    mappRoomBase: env.CAPACITY_MAPP_ROOM_BASE,
    maxQueue: env.CAPACITY_MAX_QUEUE,
    maxSockets: env.CAPACITY_MAX_SOCKETS,
    memoryLimitMb: env.CAPACITY_MEMORY_LIMIT_MB,
  },
} as const

export function getServerVersion(): ServerHelloEvent {
  return { version: config.version, buildId: config.buildId, protocol: PROTOCOL_VERSION }
}
