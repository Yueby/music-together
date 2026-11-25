import { afterEach, describe, expect, it, vi } from 'vitest'
import { getClockOffset, processPong, recordPing, resetClockSync } from './clockSync'

afterEach(() => {
  vi.restoreAllMocks()
  resetClockSync()
})

describe('clock offset RTT filtering', () => {
  it('ignores asymmetric queueing spikes even when fast samples are older and outnumbered', () => {
    let time = 0
    vi.spyOn(performance, 'now').mockImplementation(() => time)
    vi.spyOn(Date, 'now').mockImplementation(() => 100_000 + time)
    const sample = (rtt: number, offset: number) => {
      const serverTime = Date.now() + rtt / 2 + offset
      const ping = recordPing()
      time += rtt
      processPong(ping, serverTime)
      time += 1
    }
    sample(8, 42)
    sample(10, 42)
    sample(12, 43)
    // In a window of 16 samples the lowest quartile is four samples, not the minimum of three.
    sample(14, 43)
    for (let i = 0; i < 12; i++) sample(400 + i, 220)
    expect(getClockOffset()).toBe(43)
  })
})
