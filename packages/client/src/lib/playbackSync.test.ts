import { describe, expect, it, vi } from 'vitest'

const clock = vi.hoisted(() => ({ calibrated: false, serverNow: 0 }))
vi.mock('@/lib/clockSync', () => ({
  isCalibrated: () => clock.calibrated,
  getServerTime: () => clock.serverNow,
}))
import {
  compensatePlaybackPosition,
  getCompensatedScheduledPosition,
  getEffectiveAudioLatencyOffsetMs,
  getHardSeekThresholdMs,
  getScheduledPlaybackPosition,
  getScheduledServerNow,
  medianDrift,
} from './playbackSync'
import { usePlayerStore } from '@/stores/playerStore'

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

  it('advances a scheduled start by a positive offset and clamps to the track duration', () => {
    clock.calibrated = true
    clock.serverNow = 10_000
    const { setAudioLatencyOffsetMs } = usePlayerStore.getState()
    setAudioLatencyOffsetMs(200)
    expect(getCompensatedScheduledPosition(10, 10_000, 30)).toBeCloseTo(10.2)
    expect(compensatePlaybackPosition(29.95, 30)).toBe(30)
    setAudioLatencyOffsetMs(-300)
    expect(compensatePlaybackPosition(0.1, 30)).toBe(0)
    setAudioLatencyOffsetMs(null)
  })

  it('uses 0 for HTML5 audio and the live output latency for WebAudio in auto mode', () => {
    const webSound = {}
    const mappSound = { getOutputLatencyMs: vi.fn(() => 85) }
    const { setAudioLatencyOffsetMs, setDetectedAudioLatencyMs } = usePlayerStore.getState()
    setAudioLatencyOffsetMs(null)
    setDetectedAudioLatencyMs(100)
    try {
      expect(getEffectiveAudioLatencyOffsetMs(webSound)).toBe(0)
      expect(getEffectiveAudioLatencyOffsetMs(mappSound)).toBe(85)
      mappSound.getOutputLatencyMs.mockReturnValue(120)
      expect(compensatePlaybackPosition(10, 30, mappSound)).toBeCloseTo(10.12)
      expect(compensatePlaybackPosition(10, 30, webSound)).toBe(10)
      mappSound.getOutputLatencyMs.mockReturnValue(900)
      expect(compensatePlaybackPosition(10, 30, mappSound)).toBe(10.5)
    } finally {
      setDetectedAudioLatencyMs(0)
    }
  })

  it('honors the manual offset for both HTML5 audio and WebAudio', () => {
    const webSound = {}
    const mappSound = { getOutputLatencyMs: vi.fn(() => 85) }
    const { setAudioLatencyOffsetMs } = usePlayerStore.getState()
    setAudioLatencyOffsetMs(-300)
    try {
      expect(getEffectiveAudioLatencyOffsetMs(webSound)).toBe(-300)
      expect(getEffectiveAudioLatencyOffsetMs(mappSound)).toBe(-300)
      setAudioLatencyOffsetMs(500)
      expect(getEffectiveAudioLatencyOffsetMs(webSound)).toBe(500)
      expect(getEffectiveAudioLatencyOffsetMs(mappSound)).toBe(500)
      expect(mappSound.getOutputLatencyMs).not.toHaveBeenCalled()
    } finally {
      setAudioLatencyOffsetMs(null)
    }
  })

  it('filters a large outlier out of the five-sample drift window', () => {
    expect(medianDrift([0.02, 0.018, 0.95, 0.022, 0.019])).toBe(0.02)
  })
})
