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
 *   5. We keep a sliding window of samples and take the **median** offset
 *      (most robust against outliers / GC pauses).
 */

import { NTP } from '@music-together/shared'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NTPSample {
  rttMs: number
  offsetMs: number
}

interface PendingPing {
  /** `performance.now()` when the ping was sent */
  sentAt: number
  /** `Date.now()` when the ping was sent – used for offset calculation */
  localTime: number
}

// ---------------------------------------------------------------------------
// State (module-level singleton – one clock per app)
// ---------------------------------------------------------------------------

const samples: NTPSample[] = []
const pending = new Map<number, PendingPing>()
let pingCounter = 0
let medianOffset = 0
let calibrated = false

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Returns the current server time (ms) compensated by the measured offset. */
export function getServerTime(): number {
  return Date.now() + medianOffset
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
  pending.set(id, {
    sentAt: performance.now(),
    localTime: Date.now(),
  })
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

  const oneWay = rttMs / 2
  const offsetMs = serverTime - (ping.localTime + oneWay)

  samples.push({ rttMs, offsetMs })
  // Keep sliding window bounded
  if (samples.length > NTP.MAX_MEASUREMENTS) {
    samples.shift()
  }

  // Recalculate median offset
  const sorted = samples.map((s) => s.offsetMs).sort((a, b) => a - b)
  medianOffset = sorted[Math.floor(sorted.length / 2)]

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
}
