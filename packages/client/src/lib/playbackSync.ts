import { getServerTime, isCalibrated } from '@/lib/clockSync'

/** Expected playback position when a scheduled play starts after its target time. */
export function getScheduledPlaybackPosition(
  baseTime: number,
  serverTimeToExecute: number,
  currentServerTime: number,
): number {
  return baseTime + Math.max(0, currentServerTime - serverTimeToExecute) / 1000
}

/**
 * Server time to measure a scheduled start against. Before the clock is calibrated the local clock says nothing
 * about the server's, so no time is assumed to have elapsed past the execution time (a client whose clock runs
 * ahead would otherwise seek far into, or past the end of, the track).
 */
export function getScheduledServerNow(serverTimeToExecute: number): number {
  return isCalibrated() ? getServerTime() : serverTimeToExecute
}

/** Adaptive hard-seek threshold based on NTP one-way delay uncertainty. */
export function getHardSeekThresholdMs(baseThresholdMs: number, medianRttMs: number, marginMs: number): number {
  return Math.max(baseThresholdMs, medianRttMs / 2 + marginMs)
}

/** Expected authoritative position carried by a sync response at receive time. */
export function getSyncExpectedPosition(
  currentTime: number,
  isPlaying: boolean,
  responseServerTimestamp: number,
  currentServerTime: number,
  maxNetworkDelaySeconds: number,
): number {
  if (!isPlaying) return currentTime
  const networkDelaySeconds = Math.max(
    0,
    Math.min(maxNetworkDelaySeconds, (currentServerTime - responseServerTimestamp) / 1000),
  )
  return currentTime + networkDelaySeconds
}

/** Whether a drift reading (seconds) is inside the dead zone, i.e. settled. */
export function isDriftSettled(driftAbsSeconds: number, deadZoneMs: number): boolean {
  return driftAbsSeconds < deadZoneMs / 1000
}

/**
 * Adaptive sync-request interval with hysteresis: the slow interval is only
 * used while media is playing AND several consecutive settled readings were
 * observed; a pause or any fresh drift re-arms the fast interval.
 */
export function getSyncRequestIntervalMs(
  isPlaying: boolean,
  lowDriftStreak: number,
  fastIntervalMs: number,
  idleIntervalMs: number,
  slowdownConfirmCount: number,
): number {
  if (!isPlaying || lowDriftStreak < slowdownConfirmCount) return fastIntervalMs
  return idleIntervalMs
}

/** Whether a fresh unsettled reading invalidates an already scheduled slow poll. */
export function shouldRearmSyncRequest(
  wasLowDrift: boolean,
  isSettled: boolean,
): boolean {
  return wasLowDrift && !isSettled
}
