// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const artworkProps = vi.hoisted(() => ({ last: null as { loadingSlot?: ReactNode; fallback?: ReactNode } | null }))

vi.mock('@/components/ArtistNames', () => ({ ArtistNames: () => null }))
vi.mock('@/components/ArtworkImage', () => ({
  ArtworkImage: (props: { loadingSlot?: ReactNode; fallback?: ReactNode }) => {
    artworkProps.last = props
    return (
      <div data-testid="artwork-stub">
        {props.loadingSlot ? <div data-testid="stub-loading-slot">{props.loadingSlot}</div> : null}
        {props.fallback ? <div data-testid="stub-fallback">{props.fallback}</div> : null}
      </div>
    )
  },
}))
vi.mock('@/components/ui/marquee-text', () => ({ MarqueeText: ({ children }: { children: unknown }) => <span>{children as never}</span> }))

import { NowPlaying } from './NowPlaying'

const reducedMotionListeners = new Set<(event: MediaQueryListEvent) => void>()
const reducedMotionMql: {
  matches: boolean
  media: string
  onchange: ((event: MediaQueryListEvent) => void) | null
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
  addListener: ReturnType<typeof vi.fn>
  removeListener: ReturnType<typeof vi.fn>
  dispatchEvent: ReturnType<typeof vi.fn>
} = {
  matches: false,
  media: '(prefers-reduced-motion: reduce)',
  onchange: null,
  addEventListener: vi.fn((event: string, listener: (e: MediaQueryListEvent) => void) => {
    if (event === 'change') reducedMotionListeners.add(listener)
  }),
  removeEventListener: vi.fn((event: string, listener: (e: MediaQueryListEvent) => void) => {
    if (event === 'change') reducedMotionListeners.delete(listener)
  }),
  addListener: vi.fn((listener: (e: MediaQueryListEvent) => void) => {
    reducedMotionListeners.add(listener)
  }),
  removeListener: vi.fn((listener: (e: MediaQueryListEvent) => void) => {
    reducedMotionListeners.delete(listener)
  }),
  dispatchEvent: vi.fn(),
}

function setReducedMotion(reducedMotion: boolean) {
  reducedMotionMql.matches = reducedMotion
  const event = { matches: reducedMotion, media: reducedMotionMql.media } as MediaQueryListEvent
  reducedMotionMql.onchange?.(event)
  for (const listener of reducedMotionListeners) {
    listener(event)
  }
}

function mockMatchMedia(reducedMotion = false) {
  setReducedMotion(reducedMotion)
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) =>
      query.includes('prefers-reduced-motion')
        ? reducedMotionMql
        : {
            matches: false,
            media: query,
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
          },
    ),
  )
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  mockMatchMedia(false)
  artworkProps.last = null
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

  it('passes a text-free vinyl loading motif in hero mode and keeps fallback static', () => {
    act(() => root.render(<NowPlaying compact={false} />))
    expect(artworkProps.last?.loadingSlot).toBeDefined()
    expect(container.querySelector('[data-testid="cover-loading-motif"]')?.textContent).toBe('')
    expect(container.querySelector('[data-testid="cover-loading-disc"]')?.getAttribute('class')).toContain('animate-spin')

    const fallbackEl = container.querySelector('[data-testid="stub-fallback"]')
    expect(fallbackEl?.textContent).toBe('')
    expect(fallbackEl?.querySelector('svg')?.getAttribute('class')).not.toContain('animate-spin')
  })

  it('omits loadingSlot in 56px compact mode so the thumbnail stays uncluttered', () => {
    act(() => root.render(<NowPlaying compact={true} />))
    expect(artworkProps.last?.loadingSlot).toBeUndefined()
    expect(container.querySelector('[data-testid="cover-loading-motif"]')).toBeNull()
  })

  it('disables vinyl disc spin under prefers-reduced-motion', () => {
    mockMatchMedia(true)
    act(() => root.render(<NowPlaying compact={false} />))
    expect(container.querySelector('[data-testid="cover-loading-disc"]')?.getAttribute('class')).not.toContain('animate-spin')
  })
})
