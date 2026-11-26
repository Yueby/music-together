// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Slider } from './slider'

describe('Slider showThumb', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  it('shows the slider thumb by default for touch-friendly settings sliders', () => {
    act(() => {
      root.render(<Slider value={[50]} min={0} max={100} aria-label="设置滑块" />)
    })

    const thumb = container.querySelector('[data-slot="slider-thumb"]')
    expect(thumb).not.toBeNull()
    expect(thumb?.getAttribute('data-show-thumb')).toBe('always')
    expect(thumb?.className).toContain('opacity-100')
    expect(thumb?.className).not.toContain('opacity-0')
  })

  it('hides the slider thumb until hover/focus when showThumb="hover"', () => {
    act(() => {
      root.render(<Slider showThumb="hover" value={[50]} min={0} max={100} aria-label="播放进度" />)
    })

    const thumb = container.querySelector('[data-slot="slider-thumb"]')
    expect(thumb).not.toBeNull()
    expect(thumb?.getAttribute('data-show-thumb')).toBe('hover')
    expect(thumb?.className).toContain('opacity-0')
    expect(thumb?.className).toContain('group-hover/slider:opacity-100')
  })
})
