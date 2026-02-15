// ---------------------------------------------------------------------------
// Client-side timing constants (ms / s)
// ---------------------------------------------------------------------------

/** Deduplication window for PLAYER_PLAY events */
export const PLAYER_PLAY_DEDUP_MS = 2000

/** Unmute delay after seeking during track load */
export const HOWL_UNMUTE_DELAY_SEEK_MS = 400

/** Unmute delay when starting from the beginning */
export const HOWL_UNMUTE_DELAY_DEFAULT_MS = 100

/** Throttle interval for currentTime store updates */
export const CURRENT_TIME_THROTTLE_MS = 100

/** Interval for host progress reporting (keeps server state accurate) */
export const HOST_REPORT_INTERVAL_MS = 5_000

/** Interval for client-initiated sync requests (drift correction) */
export const SYNC_REQUEST_INTERVAL_MS = 2_000

/** Drift threshold (ms) before hard-seeking to correct position */
export const DRIFT_THRESHOLD_MS = 500

/** Small drift threshold (ms) — above this we use rate micro-adjustment */
export const DRIFT_RATE_THRESHOLD_MS = 15

/** Playback rate offset for gradual drift correction (2% = imperceptible) */
export const RATE_CORRECTION_FACTOR = 0.02

/** Safety clamp for network delay estimation (seconds) — prevents clock-skew outliers */
export const MAX_NETWORK_DELAY_S = 5

/** Loading time threshold (seconds) before compensating with a seek */
export const LOAD_COMPENSATION_THRESHOLD_S = 0.5

/** Safety timeout for lobby action loading state */
export const ACTION_LOADING_TIMEOUT_MS = 15_000
