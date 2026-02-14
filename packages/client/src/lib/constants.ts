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

/** Safety timeout for lobby action loading state */
export const ACTION_LOADING_TIMEOUT_MS = 15_000
