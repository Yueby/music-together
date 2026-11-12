// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/components/ArtistNames', () => ({ ArtistNames: () => null }))
vi.mock('@/components/ArtworkImage', () => ({ ArtworkImage: () => null }))
vi.mock('@/components/ui/marquee-text', () => ({ MarqueeText: ({ children }: { children: unknown }) => <span>{children as never}</span> }))

import { NowPlaying } from './NowPlaying'

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

const cover = () => container.querySelector('[role="button"]') as HTMLElement | null

describe('NowPlaying cover toggle', () => {
  it.each([
    ['cover view', false, '展开歌词', 'false'],
    ['lyric view', true, '收起歌词', 'true'],
  ])('is a focusable button in the %s that reports its state', (_name, compact, label, expanded) => {
    act(() => root.render(<NowPlaying compact={compact} onCoverClick={vi.fn()} />))
    expect(cover()?.tabIndex).toBe(0)
    expect(cover()?.getAttribute('aria-label')).toBe(label)
    expect(cover()?.getAttribute('aria-expanded')).toBe(expanded)
  })

  it.each(['Enter', ' '])('toggles with the %j key', (key) => {
    const onCoverClick = vi.fn()
    act(() => root.render(<NowPlaying onCoverClick={onCoverClick} />))
    act(() => void cover()!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })))
    expect(onCoverClick).toHaveBeenCalledOnce()
  })

  it('is not a button when the cover does nothing', () => {
    act(() => root.render(<NowPlaying />))
    expect(cover()).toBeNull()
  })
})
