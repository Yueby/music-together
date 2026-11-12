import { describe, expect, it, vi } from 'vitest'

const clock = vi.hoisted(() => ({ calibrated: false, serverNow: 0 }))
vi.mock('@/lib/clockSync', () => ({
  isCalibrated: () => clock.calibrated,
  getServerTime: () => clock.serverNow,
}))
import {
  getHardSeekThresholdMs,
  getScheduledPlaybackPosition,
  getScheduledServerNow,
  getSyncExpectedPosition,
  getSyncRequestIntervalMs,
  isDriftSettled,
  shouldRearmSyncRequest,
} from './playbackSync'

describe('playback sync helpers', () => {
  it('assumes no time has elapsed past the start while the clock is uncalibrated', () => {
    clock.calibrated = false
    clock.serverNow = 99_999
    // A local clock minutes ahead must not push the seek past the start position.
    expect(getScheduledPlaybackPosition(12, 10_000, getScheduledServerNow(10_000))).toBe(12)
  })

  it('measures from the calibrated server clock once available', () => {
    clock.calibrated = true
    clock.serverNow = 10_250
    expect(getScheduledPlaybackPosition(12, 10_000, getScheduledServerNow(10_000))).toBe(12.25)
  })

  it('compensates playback position when a scheduled start is late', () => {
    expect(getScheduledPlaybackPosition(12, 10_000, 10_250)).toBe(12.25)
  })

  it('does not move playback backwards before the scheduled time', () => {
    expect(getScheduledPlaybackPosition(12, 10_000, 9_800)).toBe(12)
  })

  it('uses one-way latency rather than full RTT for the hard-seek threshold', () => {
    expect(getHardSeekThresholdMs(500, 1_000, 100)).toBe(600)
    expect(getHardSeekThresholdMs(500, 40, 100)).toBe(500)
  })

  it('compensates a playing sync response for receive delay', () => {
    expect(getSyncExpectedPosition(20, true, 10_000, 10_250, 5)).toBe(20.25)
  })

  it('does not advance paused sync responses or accept negative delay', () => {
    expect(getSyncExpectedPosition(20, false, 10_000, 10_250, 5)).toBe(20)
    expect(getSyncExpectedPosition(20, true, 10_000, 9_750, 5)).toBe(20)
  })

  it('classifies drift readings below the dead zone as settled', () => {
    expect(isDriftSettled(0.02, 30)).toBe(true)
    expect(isDriftSettled(0.03, 30)).toBe(false)
    expect(isDriftSettled(0.5, 30)).toBe(false)
  })

  it('slows sync requests only after enough consecutive settled readings while playing', () => {
    expect(getSyncRequestIntervalMs(true, 2, 2_000, 5_000, 2)).toBe(5_000)
    expect(getSyncRequestIntervalMs(true, 3, 2_000, 5_000, 2)).toBe(5_000)
    expect(getSyncRequestIntervalMs(true, 1, 2_000, 5_000, 2)).toBe(2_000)
  })

  it('re-arms the fast sync interval when the media is paused or not playing', () => {
    expect(getSyncRequestIntervalMs(false, 5, 2_000, 5_000, 2)).toBe(2_000)
    expect(getSyncRequestIntervalMs(false, 0, 2_000, 5_000, 2)).toBe(2_000)
  })

  it('re-arms a slow poll only when a settled streak becomes unsettled', () => {
    expect(shouldRearmSyncRequest(true, false)).toBe(true)
    expect(shouldRearmSyncRequest(true, true)).toBe(false)
    expect(shouldRearmSyncRequest(false, false)).toBe(false)
  })
})
