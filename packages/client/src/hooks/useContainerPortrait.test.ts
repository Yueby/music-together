import { describe, expect, it } from 'vitest'
import { shouldUsePortraitLayout } from './useContainerPortrait'

describe('shouldUsePortraitLayout', () => {
  it('always uses two-column layout when width >= height', () => {
    expect(shouldUsePortraitLayout(1200, 800, true)).toBe(false)
    expect(shouldUsePortraitLayout(667, 375, true)).toBe(false)
    expect(shouldUsePortraitLayout(800, 800, true)).toBe(false)
  })

  it('keeps two-column layout in wide near-square desktop states (e.g. chat panel open)', () => {
    // 950x1080 -> ratio 0.88, plenty of horizontal room for cover + lyrics
    expect(shouldUsePortraitLayout(950, 1080, false)).toBe(false)
    expect(shouldUsePortraitLayout(950, 1080, true)).toBe(false)
  })

  it('switches to portrait layout on narrow or tall containers (phones, portrait tablets, narrow split windows)', () => {
    expect(shouldUsePortraitLayout(375, 812, false)).toBe(true)
    expect(shouldUsePortraitLayout(720, 960, false)).toBe(true)
    // Wide enough in px, but too tall vertically (< 0.72 ratio)
    expect(shouldUsePortraitLayout(820, 1200, false)).toBe(true)
  })

  it('applies hysteresis around the width/ratio boundary to prevent flicker', () => {
    // 780x980 -> width between 760 and 800, ratio 0.796: stays in current mode
    expect(shouldUsePortraitLayout(780, 980, false)).toBe(false)
    expect(shouldUsePortraitLayout(780, 980, true)).toBe(true)
  })
})
