// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MUSIC_SOURCES } from '@music-together/shared'
import { PLATFORM_DOT, PLATFORM_LABELS } from '@/lib/platform'
import { PlatformMark, PlatformSelect } from './PlatformSelect'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('PlatformMark', () => {
  it.each(MUSIC_SOURCES)('renders a fixed-viewBox vector glyph without text for %s', (platform) => {
    act(() => root.render(<PlatformMark platform={platform} />))

    const mark = container.querySelector<HTMLSpanElement>(`[data-platform-mark="${platform}"]`)
    expect(mark).not.toBeNull()
    expect(mark?.getAttribute('aria-hidden')).toBe('true')
    expect(mark?.className).toContain(PLATFORM_DOT[platform])
    expect(mark?.textContent).toBe('')

    const svg = mark?.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('viewBox')).toBe('0 0 20 20')
    // Explicit size- and text- classes prevent SelectTrigger / SelectItem selectors from overriding mark size/color.
    expect(svg?.getAttribute('class')).toContain('size-5')
    expect(svg?.getAttribute('class')).toContain('text-white')
    expect(svg?.querySelectorAll('path, ellipse').length).toBeGreaterThan(0)
  })
})

describe('PlatformSelect', () => {
  it('renders the selected platform vector mark and accessible label on the trigger', () => {
    act(() => root.render(<PlatformSelect value="kugou" onChange={vi.fn()} />))

    const trigger = container.querySelector<HTMLButtonElement>('[data-slot="select-trigger"]')
    expect(trigger?.getAttribute('aria-label')).toBe(`音乐平台：${PLATFORM_LABELS.kugou}`)
    expect(trigger?.querySelector('[data-platform-mark="kugou"] svg')).not.toBeNull()
  })
})
