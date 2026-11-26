import { describe, expect, it, vi } from 'vitest'
import { setHowlPosition } from './howlPosition'

describe('setHowlPosition', () => {
  it('seeks with soundId when provided and clamps negative targets to 0', () => {
    const seek = vi.fn()
    const howl = { playing: vi.fn(() => true), seek }

    setHowlPosition(howl, 12.5, 7)
    expect(seek).toHaveBeenLastCalledWith(12.5, 7)

    setHowlPosition(howl, -3, 7)
    expect(seek).toHaveBeenLastCalledWith(0, 7)
  })

  it('omits soundId when not provided', () => {
    const seek = vi.fn()
    const howl = { playing: vi.fn(() => false), seek }

    setHowlPosition(howl, 8)
    expect(seek).toHaveBeenCalledExactlyOnceWith(8)
  })
})
