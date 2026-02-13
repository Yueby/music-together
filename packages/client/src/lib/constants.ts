// ---------------------------------------------------------------------------
// Client-side timing constants (ms)
// ---------------------------------------------------------------------------

/** Deduplication window for PLAYER_PLAY events */
export const PLAYER_PLAY_DEDUP_MS = 2000

/** Unmute delay after seeking during track load */
export const HOWL_UNMUTE_DELAY_SEEK_MS = 1200

/** Unmute delay when starting from the beginning */
export const HOWL_UNMUTE_DELAY_DEFAULT_MS = 100

/** Throttle interval for currentTime store updates */
export const CURRENT_TIME_THROTTLE_MS = 100

/** Grace period before sync is considered ready after seek */
export const SYNC_READY_DELAY_MS = 800

/** Interval for client-initiated sync requests (fallback only) */
export const SYNC_REQUEST_INTERVAL_MS = 30_000

/** Interval for host progress reporting */
export const HOST_REPORT_INTERVAL_MS = 3_000

/** Drift threshold (seconds) before correcting playback position */
export const SYNC_DRIFT_THRESHOLD_S = 0.5

/** Safety timeout for lobby action loading state */
export const ACTION_LOADING_TIMEOUT_MS = 15_000

