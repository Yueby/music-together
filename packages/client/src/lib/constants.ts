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

/** Interval for host progress reporting — normal (steady state) */
export const HOST_REPORT_INTERVAL_MS = 5_000

/** Interval for host progress reporting — fast (first seconds of a new track) */
export const HOST_REPORT_FAST_INTERVAL_MS = 2_000

/** Duration (ms) of the fast host reporting phase after a new track starts */
export const HOST_REPORT_FAST_DURATION_MS = 10_000

/** Interval for client-initiated sync requests (drift correction) */
export const SYNC_REQUEST_INTERVAL_MS = 2_000

/** Drift threshold (ms) before hard-seeking to correct position */
export const DRIFT_SEEK_THRESHOLD_MS = 200

/** Dead zone (ms) — below this drift we restore rate to 1.0 (no correction) */
export const DRIFT_DEAD_ZONE_MS = 30

/** Proportional gain for drift correction: rate = 1 - clamp(drift * Kp) */
export const DRIFT_RATE_KP = 0.25

/** Maximum rate adjustment magnitude (±1% cap) */
export const MAX_RATE_ADJUSTMENT = 0.01

/** EMA smoothing factor for drift measurements (0–1, higher = more responsive) */
export const DRIFT_SMOOTH_ALPHA = 0.3

/** Fallback seek threshold (ms) when rate correction is disabled by plugin */
export const DRIFT_PLUGIN_SEEK_THRESHOLD_MS = 30

/** Safety clamp for network delay estimation (seconds) — prevents clock-skew outliers */
export const MAX_NETWORK_DELAY_S = 5

/** Loading time threshold (seconds) before compensating with a seek */
export const LOAD_COMPENSATION_THRESHOLD_S = 0.5

/** Safety timeout for lobby action loading state */
export const ACTION_LOADING_TIMEOUT_MS = 15_000
