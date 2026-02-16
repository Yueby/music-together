/**
 * NTP-inspired clock synchronisation engine.
 *
 * Maintains a running estimate of the offset between the local clock
 * (`Date.now()`) and the server clock so that `getServerTime()` returns
 * a value aligned with the server's `Date.now()`.
 *
 * Algorithm:
 *   1. Client sends NTP_PING with `clientPingId` (= monotonic counter).
 *   2. Server immediately replies NTP_PONG with `{ clientPingId, serverTime }`.
 *   3. Client records `t0` (when ping was sent, via `performance.now()`)
 *      and `t2` (when pong arrived, via `performance.now()`).
 *   4. RTT  = t2 - t0
 *      offset = serverTime - (clientLocalTimeAtPing + RTT / 2)
 *   5. We keep a sliding window of samples and compute a **time-decayed
 *      weighted median** offset — recent samples contribute more, giving
 *      both the robustness of median filtering and fast convergence when
 *      network conditions change (e.g. WiFi → cellular handoff).
 */

import { NTP } from '@music-together/shared'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NTPSample {
  rttMs: number
  offsetMs: number
  /** `Date.now()` when the sample was recorded */
  timestamp: number
}

interface PendingPing {
  /** `performance.now()` when the ping was sent */
  sentAt: number
  /** `Date.now()` when the ping was sent – used for offset calculation */
  localTime: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Half-life (ms) for exponential decay weighting of NTP samples.
 *  Samples older than ~30s contribute roughly half the weight of fresh ones. */
const DECAY_HALF_LIFE_MS = 30_000

// ---------------------------------------------------------------------------
// State (module-level singleton – one clock per app)
// ---------------------------------------------------------------------------

const samples: NTPSample[] = []
const pending = new Map<number, PendingPing>()
let pingCounter = 0
let medianOffset = 0
let calibrated = false

// Anchor pair for monotonic getServerTime().
// `performance.now()` is monotonic and immune to system clock adjustments
// (NTP sync, manual time change, sleep/wake). We anchor a known server-time
// to a performance.now() reading and derive future server-times from the
// elapsed monotonic time, eliminating Date.now() jitter from getServerTime().
let anchorPerfNow = performance.now()
let anchorServerTime = Date.now() // uncalibrated initially; updated on each pong

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Compute time-decayed weighted median of offset values.
 * Each sample's weight = exp(-age / halfLife), so recent samples dominate.
 * We find the offset where cumulative weight first exceeds 50% of total.
 */
function computeWeightedMedian(now: number): number {
  if (samples.length === 0) return 0
  if (samples.length === 1) return samples[0].offsetMs

  // Build (offset, weight) pairs
  const pairs: { offset: number; weight: number }[] = []
  for (const s of samples) {
    const age = now - s.timestamp
    const weight = Math.exp((-age * Math.LN2) / DECAY_HALF_LIFE_MS)
    pairs.push({ offset: s.offsetMs, weight })
  }

  // Sort by offset ascending
  pairs.sort((a, b) => a.offset - b.offset)

  // Find weighted median
  let totalWeight = 0
  for (const p of pairs) totalWeight += p.weight
  const halfWeight = totalWeight / 2

  let cumWeight = 0
  for (const p of pairs) {
    cumWeight += p.weight
    if (cumWeight >= halfWeight) return p.offset
  }

  // Fallback (should not reach here)
  return pairs[pairs.length - 1].offset
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Returns the current server time (ms) compensated by the measured offset.
 *  Uses a monotonic `performance.now()` anchor so the result is immune to
 *  system clock adjustments (NTP sync, manual time change, sleep/wake). */
export function getServerTime(): number {
  return anchorServerTime + (performance.now() - anchorPerfNow)
}

/** Whether the initial calibration phase has completed. */
export function isCalibrated(): boolean {
  return calibrated
}

/** Current smoothed RTT (ms) – the median of all stored samples. */
export function getMedianRTT(): number {
  if (samples.length === 0) return 0
  const sorted = samples.map((s) => s.rttMs).sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/** Current clock offset (ms).  Positive = local clock is behind server. */
export function getClockOffset(): number {
  return medianOffset
}

// ---------------------------------------------------------------------------
// Ping / Pong helpers (called by useClockSync hook)
// ---------------------------------------------------------------------------

/**
 * Record a pending ping.  Returns the `clientPingId` to send to the server.
 */
export function recordPing(): number {
  const id = ++pingCounter
  const now = Date.now()
  pending.set(id, {
    sentAt: performance.now(),
    localTime: now,
  })
  // Purge stale entries older than 10 seconds (server never responded)
  const staleThreshold = now - 10_000
  for (const [k, v] of pending) {
    if (v.localTime < staleThreshold) pending.delete(k)
    else break // Map preserves insertion order; once we hit a fresh entry, stop
  }
  return id
}

/**
 * Process a pong response from the server.
 * Returns the computed RTT so the caller can forward it to the server.
 */
export function processPong(clientPingId: number, serverTime: number): number | null {
  const ping = pending.get(clientPingId)
  if (!ping) return null
  pending.delete(clientPingId)

  const t2 = performance.now()
  const rttMs = t2 - ping.sentAt
  // Discard obviously bad samples (negative or huge RTT)
  if (rttMs < 0 || rttMs > 10_000) return null

  const now = Date.now()
  const oneWay = rttMs / 2
  const offsetMs = serverTime - (ping.localTime + oneWay)

  samples.push({ rttMs, offsetMs, timestamp: now })
  // Keep sliding window bounded
  if (samples.length > NTP.MAX_MEASUREMENTS) {
    samples.shift()
  }

  // Recalculate time-decayed weighted median offset
  medianOffset = computeWeightedMedian(now)

  // Refresh the monotonic anchor so getServerTime() stays accurate
  anchorPerfNow = performance.now()
  anchorServerTime = Date.now() + medianOffset

  if (!calibrated && samples.length >= NTP.MAX_INITIAL_SAMPLES) {
    calibrated = true
  }

  return rttMs
}

/** Reset all state (useful on disconnect). */
export function resetClockSync(): void {
  samples.length = 0
  pending.clear()
  pingCounter = 0
  medianOffset = 0
  calibrated = false
  anchorPerfNow = performance.now()
  anchorServerTime = Date.now()
}
