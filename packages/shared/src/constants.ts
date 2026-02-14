export const LIMITS = {
  ROOM_PASSWORD_MAX_LENGTH: 32,
  ROOM_NAME_MAX_LENGTH: 30,
  NICKNAME_MAX_LENGTH: 20,
  CHAT_CONTENT_MAX_LENGTH: 500,
  CHAT_HISTORY_MAX: 200,
  CHAT_RATE_LIMIT_PER_SECOND: 5,
  QUEUE_MAX_SIZE: 100,
  SEARCH_KEYWORD_MAX_LENGTH: 100,
  SEARCH_PAGE_SIZE_MAX: 50,
  SEARCH_PAGE_MAX: 100,
} as const

export const TIMING = {
  ROOM_GRACE_PERIOD_MS: 60_000,
  ROLE_GRACE_PERIOD_MS: 30_000,
  PLAYER_NEXT_DEBOUNCE_MS: 500,
  VOTE_TIMEOUT_MS: 30_000,
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
