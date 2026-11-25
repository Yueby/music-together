import { getServerTime, isCalibrated } from '@/lib/clockSync'
import { AUDIO_LATENCY_MAX_MS } from '@/lib/constants'
import type { PlaybackSound } from '@/lib/PlaybackSound'
import { usePlayerStore } from '@/stores/playerStore'

type OutputLatencySource = Pick<PlaybackSound, 'getOutputLatencyMs'>

export function getSoundOutputLatencyMs(sound?: OutputLatencySource | null): number {
  const milliseconds = sound?.getOutputLatencyMs?.() ?? 0
  return Number.isFinite(milliseconds) ? Math.max(0, Math.min(milliseconds, AUDIO_LATENCY_MAX_MS)) : 0
}

export function getEffectiveAudioLatencyOffsetMs(sound?: OutputLatencySource | null): number {
  return usePlayerStore.getState().audioLatencyOffsetMs ?? getSoundOutputLatencyMs(sound)
}

export function compensatePlaybackPosition(position: number, duration: number, sound?: OutputLatencySource | null): number {
  // Start the media ahead by the time audio takes to reach the listener.
  const target = Math.max(0, position + getEffectiveAudioLatencyOffsetMs(sound) / 1000)
  return duration > 0 ? Math.min(target, duration) : target
}

export function medianDrift(samples: readonly number[]): number {
  const sorted = [...samples].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

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

export function getCompensatedScheduledPosition(
  baseTime: number,
  serverTimeToExecute: number,
  duration: number,
  sound?: OutputLatencySource | null,
): number {
  return compensatePlaybackPosition(
    getScheduledPlaybackPosition(baseTime, serverTimeToExecute, getScheduledServerNow(serverTimeToExecute)),
    duration,
    sound,
  )
}

/** Adaptive hard-seek threshold based on NTP one-way delay uncertainty. */
export function getHardSeekThresholdMs(baseThresholdMs: number, medianRttMs: number, marginMs: number): number {
  return Math.max(baseThresholdMs, medianRttMs / 2 + marginMs)
}
