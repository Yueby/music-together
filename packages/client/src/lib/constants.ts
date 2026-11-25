// ---------------------------------------------------------------------------
// Client-side timing constants (ms / s)
// ---------------------------------------------------------------------------

/** Deduplication window for PLAYER_PLAY events */
export const PLAYER_PLAY_DEDUP_MS = 2000

/** Throttle interval for currentTime store updates */
export const CURRENT_TIME_THROTTLE_MS = 100

export const SYNC_REQUEST_INTERVAL_MS = 15_000
export const DRIFT_SAMPLE_INTERVAL_MS = 250
export const DRIFT_SAMPLE_COUNT = 5
export const WEB_AUDIO_SEEK_THRESHOLD_MS = 120
export const WEB_AUDIO_MAX_RATE_ADJUSTMENT = 0.003
export const AUDIO_LATENCY_MIN_MS = -300
export const AUDIO_LATENCY_MAX_MS = 500

/** Drift threshold (ms) before hard-seeking to correct position.
 * Native HTML5 media seeks may flush decoder buffers on mobile, so only
 * clearly disruptive drift should use this path. */
export const DRIFT_SEEK_THRESHOLD_MS = 500

/** Dead zone (ms) — below this drift we restore uninterrupted 1.0x audio.
 * Keep this small: soft rate correction is continuous and non-seeking, so it
 * must remain active for ordinary clock-rate drift instead of letting errors
 * accumulate toward the hard-seek threshold. */
export const DRIFT_DEAD_ZONE_MS = 15

/** Proportional gain for drift correction: rate = 1 - clamp(drift * Kp) */
export const DRIFT_RATE_KP = 0.25

/** Maximum rate adjustment magnitude (±2% cap — increased from 1% to
 *  allow faster soft convergence on high-latency connections, reducing
 *  the time the system spends near the hard-seek threshold). */
export const MAX_RATE_ADJUSTMENT = 0.02

/** EMA smoothing factor for drift measurements (0–1, higher = more responsive).
 *  Lowered from 0.3 to 0.2 for more noise suppression on high-latency links. */
export const DRIFT_SMOOTH_ALPHA = 0.2

/** Extra margin (ms) added to the estimated one-way delay when computing
 *  the adaptive hard-seek threshold. Final threshold = max(
 *  DRIFT_SEEK_THRESHOLD_MS, medianRTT / 2 + DRIFT_SEEK_RTT_MARGIN_MS).
 *  NTP offset uncertainty is bounded by one-way delay, not the full RTT. */
export const DRIFT_SEEK_RTT_MARGIN_MS = 100

/** Number of consecutive filtered samples beyond the hard-seek threshold. */
export const HARD_SEEK_CONFIRM_COUNT = 3

/** Loading time threshold (seconds) before compensating with a seek */
export const LOAD_COMPENSATION_THRESHOLD_S = 0.15

/** 加载补偿 seek 的最大值（秒），防止网络慢时跳过歌曲开头过多 */
export const MAX_LOAD_COMPENSATION_S = 2

/** Safety timeout for lobby action loading state */
export const ACTION_LOADING_TIMEOUT_MS = 15_000
