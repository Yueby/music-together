// ---------------------------------------------------------------------------
// Client-side timing constants (ms / s)
// ---------------------------------------------------------------------------

/** Deduplication window for PLAYER_PLAY events */
export const PLAYER_PLAY_DEDUP_MS = 2000

/** Unmute delay after seeking during track load */
export const HOWL_UNMUTE_DELAY_SEEK_MS = 1200

/** Unmute delay when starting from the beginning */
export const HOWL_UNMUTE_DELAY_DEFAULT_MS = 100

/** Throttle interval for currentTime store updates */
export const CURRENT_TIME_THROTTLE_MS = 100

/** Interval for client-initiated sync requests (fallback only) */
export const SYNC_REQUEST_INTERVAL_MS = 15_000

/** Interval for host progress reporting */
export const HOST_REPORT_INTERVAL_MS = 2_000

// ---------------------------------------------------------------------------
// Drift correction thresholds (seconds)
// ---------------------------------------------------------------------------

/**
 * Drift above this threshold triggers a hard seek (audible but rare).
 * Below this we use playback-rate micro-adjustment instead.
 */
export const DRIFT_HARD_SEEK_THRESHOLD_S = 0.3

/**
 * Drift above this threshold (but below hard-seek) triggers a slight
 * playback-rate change (imperceptible to listeners).
 * Below this we do nothing.
 */
export const DRIFT_RATE_THRESHOLD_S = 0.015

/**
 * How much to deviate from 1.0 playback rate when correcting drift.
 * 0.02 = 2% speed-up / slow-down — closes a 100ms gap in ~5 seconds.
 */
export const RATE_CORRECTION_FACTOR = 0.02

/** Safety timeout for lobby action loading state */
export const ACTION_LOADING_TIMEOUT_MS = 15_000

