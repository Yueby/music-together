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

/** Interval for conductor progress reporting — normal (steady state) */
export const CONDUCTOR_REPORT_INTERVAL_MS = 5_000

/** Interval for conductor progress reporting — fast (first seconds of a new track) */
export const CONDUCTOR_REPORT_FAST_INTERVAL_MS = 2_000

/** Duration (ms) of the fast conductor reporting phase after a new track starts */
export const CONDUCTOR_REPORT_FAST_DURATION_MS = 10_000

/** Interval for client-initiated sync requests (drift correction) */
export const SYNC_REQUEST_INTERVAL_MS = 2_000

/** Drift threshold (ms) before hard-seeking to correct position */
export const DRIFT_SEEK_THRESHOLD_MS = 200

/** Dead zone (ms) — below this drift we restore rate to 1.0 (no correction) */
export const DRIFT_DEAD_ZONE_MS = 30

/** Proportional gain for drift correction: rate = 1 - clamp(drift * Kp) */
export const DRIFT_RATE_KP = 0.25

/** Maximum rate adjustment magnitude (±2% cap — increased from 1% to
 *  allow faster soft convergence on high-latency connections, reducing
 *  the time the system spends near the hard-seek threshold). */
export const MAX_RATE_ADJUSTMENT = 0.02

/** EMA smoothing factor for drift measurements (0–1, higher = more responsive).
 *  Lowered from 0.3 to 0.2 for more noise suppression on high-latency links. */
export const DRIFT_SMOOTH_ALPHA = 0.2

/** Fallback seek threshold (ms) when rate correction is disabled by plugin */
export const DRIFT_PLUGIN_SEEK_THRESHOLD_MS = 30

/** Grace period (ms) after new track before drift correction activates.
 *  Allows at least one conductor report to correct estimateCurrentTime. */
export const DRIFT_GRACE_PERIOD_MS = 3_000

/** Extra margin (ms) added to the median RTT when computing the adaptive
 *  hard-seek threshold.  Final threshold = max(DRIFT_SEEK_THRESHOLD_MS,
 *  medianRTT + DRIFT_SEEK_RTT_MARGIN_MS).  This prevents high-latency
 *  NTP jitter from repeatedly triggering hard seeks. */
export const DRIFT_SEEK_RTT_MARGIN_MS = 100

/** Number of consecutive sync responses whose smoothed drift exceeds
 *  the hard-seek threshold before actually seeking.  Prevents a single
 *  noisy measurement from causing an audible jump. */
export const HARD_SEEK_CONFIRM_COUNT = 2

/** Safety clamp for network delay estimation (seconds) — prevents clock-skew outliers */
export const MAX_NETWORK_DELAY_S = 5

/** Loading time threshold (seconds) before compensating with a seek */
export const LOAD_COMPENSATION_THRESHOLD_S = 0.15

/** 加载补偿 seek 的最大值（秒），防止网络慢时跳过歌曲开头过多 */
export const MAX_LOAD_COMPENSATION_S = 2

/** Safety timeout for lobby action loading state */
export const ACTION_LOADING_TIMEOUT_MS = 15_000
