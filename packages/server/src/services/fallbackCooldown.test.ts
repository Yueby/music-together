import { describe, expect, it } from 'vitest'
import { createFallbackCooldown } from './fallbackCooldown.js'

function setup() {
  let time = 1_000
  const cooldown = createFallbackCooldown(() => time)
  return { cooldown, advance: (ms: number) => (time += ms) }
}

describe('fallbackCooldown', () => {
  it('lets a track be tried until it is marked, then blocks it for the cooldown', () => {
    const { cooldown, advance } = setup()
    expect(cooldown.canTry('R1', 't1')).toBe(true)
    cooldown.mark('R1', 't1', 60_000)
    expect(cooldown.canTry('R1', 't1')).toBe(false)
    advance(59_999)
    expect(cooldown.canTry('R1', 't1')).toBe(false)
    advance(1)
    expect(cooldown.canTry('R1', 't1')).toBe(true)
  })

  it('keeps tracks and rooms apart', () => {
    const { cooldown } = setup()
    cooldown.mark('R1', 't1', 60_000)
    expect(cooldown.canTry('R1', 't2')).toBe(true)
    expect(cooldown.canTry('R2', 't1')).toBe(true)
  })

  it('forgets a destroyed room without touching the others', () => {
    const { cooldown } = setup()
    cooldown.mark('R1', 't1', 60_000)
    cooldown.mark('R2', 't1', 60_000)
    cooldown.clearRoom('R1')
    expect(cooldown.canTry('R1', 't1')).toBe(true)
    expect(cooldown.canTry('R2', 't1')).toBe(false)
  })
})
