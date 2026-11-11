import type { MusicSource } from './types.js'

/** Every supported music platform: the one list the schemas, pickers and per-platform loops are built from. */
export const MUSIC_SOURCES = ['netease', 'tencent', 'kugou'] as const satisfies readonly MusicSource[]

/** A room id as it travels in URLs, queries and events: nanoid's alphabet, 1–20 characters. The one definition. */
export const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{1,20}$/

/** What a track's artist list says when the platform credited nobody. It names no one, so it must not be linked. */
export const UNKNOWN_ARTIST = 'Unknown'

/** Platforms with artist search and artist pages. */
export const ARTIST_SOURCES: readonly MusicSource[] = ['netease']

/**
 * Platforms that offer the personal discovery content of the account page (daily songs, recommended playlists, radar,
 * recommended artists, new albums). The server enforces it and the client says "not provided" for the others.
 */
export const DISCOVER_SOURCES: readonly MusicSource[] = ['netease']

export const LIMITS = {
  ROOM_PASSWORD_MAX_LENGTH: 32,
  ROOM_NAME_MAX_LENGTH: 30,
  NICKNAME_MAX_LENGTH: 20,
  CHAT_CONTENT_MAX_LENGTH: 500,
  CHAT_HISTORY_MAX: 200,
  CHAT_RATE_LIMIT_PER_SECOND: 5,
  QUEUE_MAX_SIZE: 200,
  QUEUE_BATCH_MAX_SIZE: 200,
  SEARCH_KEYWORD_MAX_LENGTH: 100,
  SEARCH_PAGE_SIZE_MAX: 50,
  SEARCH_PAGE_MAX: 100,
  PLAYLIST_ID_MAX_LENGTH: 200,
} as const

export const TIMING = {
  ROOM_GRACE_PERIOD_MS: 60_000,
  PLAYER_NEXT_DEBOUNCE_MS: 500,
  VOTE_TIMEOUT_MS: 30_000,
} as const

/** QR code login status codes (shared between client polling and server responses) */
export const QR_STATUS = {
  EXPIRED: 800,
  WAITING_SCAN: 801,
  SCANNED: 802,
  SUCCESS: 803,
} as const

/** QR code polling timing */
export const QR_TIMING = {
  POLL_INTERVAL_MS: 2_000,
  SUCCESS_CLOSE_DELAY_MS: 1_000,
} as const

/** NTP clock synchronisation constants */
export const NTP = {
  /** Fast sampling interval during initial calibration (ms) */
  INITIAL_INTERVAL_MS: 50,
  /** Steady-state heartbeat interval after initial calibration (ms) */
  STEADY_STATE_INTERVAL_MS: 5_000,
  /** Number of rapid samples to collect during initial calibration */
  MAX_INITIAL_SAMPLES: 20,
  /** Maximum stored measurements (sliding window) */
  MAX_MEASUREMENTS: 60,
  /** Minimum scheduling delay for scheduled execution (ms) */
  MIN_SCHEDULE_DELAY_MS: 300,
  /** Maximum scheduling delay cap (ms) */
  MAX_SCHEDULE_DELAY_MS: 3_000,
} as const
