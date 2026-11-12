import { describe, expect, it } from 'vitest'
import { rejoinTicketExpiry } from './rejoinTicket.js'

describe('rejoinTicketExpiry', () => {
  it('counts the lifetime from when the ticket arrived, whatever the two clocks say', () => {
    // the server stamped 60 s from ITS now (1_000_000); this machine runs 10 minutes ahead of it
    const received = 1_600_000
    expect(rejoinTicketExpiry({ expiresAt: 1_060_000, ttlMs: 60_000 }, received)).toBe(1_660_000)
  })

  it('falls back to the server stamp when the server did not say how long the ticket lives', () => {
    expect(rejoinTicketExpiry({ expiresAt: 1_060_000 }, 1_000_000)).toBe(1_060_000)
  })

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])('does not trust a lifetime of %s', (ttlMs) => {
    expect(rejoinTicketExpiry({ expiresAt: 1_060_000, ttlMs }, 1_000_000)).toBe(1_060_000)
  })
})
