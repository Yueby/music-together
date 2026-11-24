// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const artwork = vi.hoisted(() => ({ result: { src: undefined, failed: false } as { src?: string; failed: boolean } }))
vi.mock('@/hooks/useArtworkUrl', () => ({ useArtwork: () => artwork.result }))

import { ArtworkImage } from './ArtworkImage'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

const render = (props: Partial<React.ComponentProps<typeof ArtworkImage>> = {}) =>
  act(() => root.render(<ArtworkImage fallback={<span data-testid="fallback" />} {...props} />))
const skeleton = () => container.querySelector('[data-slot=skeleton]')
const artworkLoading = () => container.querySelector('[data-slot=artwork-loading]')
const artworkShimmer = () => container.querySelector('[data-slot=artwork-shimmer]')
const fallback = () => container.querySelector('[data-testid=fallback]')
const img = () => container.querySelector('img')

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

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  mockMatchMedia(false)
  artwork.result = { src: undefined, failed: false }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('ArtworkImage', () => {
  it('shows only the fallback when there is no artwork at all', () => {
    render({ cover: undefined })
    expect(fallback()).not.toBeNull()
    expect(skeleton()).toBeNull()
    expect(img()).toBeNull()
  })

  it('shows a loading block, not the fallback, while the host is still reading the picture', () => {
    render({ cover: 'https://cdn.test/a.jpg' })
    expect(skeleton()).not.toBeNull()
    expect(fallback()).toBeNull()
  })

  it('looks like loading when what it belongs to is still being fetched', () => {
    render({ cover: undefined, pending: true })
    expect(skeleton()).not.toBeNull()
    expect(fallback()).toBeNull()
  })

  it('keeps loading while the image downloads, then fades it in', () => {
    artwork.result = { src: 'https://cdn.test/a.jpg', failed: false }
    render({ cover: 'https://cdn.test/a.jpg' })
    expect(skeleton()).not.toBeNull()
    expect(img()?.className).toContain('opacity-0')

    act(() => img()!.dispatchEvent(new Event('load')))
    expect(skeleton()).toBeNull()
    expect(img()?.className).toContain('opacity-100')
    expect(fallback()).toBeNull()
  })

  it('falls back when the image cannot be shown', () => {
    artwork.result = { src: 'https://cdn.test/broken.jpg', failed: false }
    render({ cover: 'https://cdn.test/broken.jpg' })
    act(() => img()!.dispatchEvent(new Event('error')))
    expect(img()).toBeNull()
    expect(skeleton()).toBeNull()
    expect(fallback()).not.toBeNull()
  })

  it('falls back when the host gave up reading the picture', () => {
    artwork.result = { src: undefined, failed: true }
    render({ cover: 'https://cdn.test/a.jpg' })
    expect(fallback()).not.toBeNull()
    expect(skeleton()).toBeNull()
  })

  it('shows loading for a row that has not been asked to load yet', () => {
    render({ cover: 'https://cdn.test/a.jpg', load: false })
    expect(skeleton()).not.toBeNull()
    expect(img()).toBeNull()
  })

  it('does not call a new picture loaded because the previous one was', () => {
    artwork.result = { src: 'https://cdn.test/a.jpg', failed: false }
    render({ cover: 'https://cdn.test/a.jpg' })
    act(() => img()!.dispatchEvent(new Event('load')))
    artwork.result = { src: 'https://cdn.test/b.jpg', failed: false }
    render({ cover: 'https://cdn.test/b.jpg' })
    expect(skeleton()).not.toBeNull()
    expect(img()?.className).toContain('opacity-0')
  })

  it('renders layered loading surface and optional loadingSlot only while loading, then reveals with scale settle', () => {
    artwork.result = { src: 'https://cdn.test/hero.jpg', failed: false }
    render({
      cover: 'https://cdn.test/hero.jpg',
      loadingSlot: <span data-testid="loading-slot">封面加载中…</span>,
    })

    expect(artworkLoading()).not.toBeNull()
    expect(artworkShimmer()).not.toBeNull()
    expect(container.querySelector('[data-testid="loading-slot"]')).not.toBeNull()
    expect(img()?.className).toContain('scale-[1.02]')
    expect(img()?.className).toContain('opacity-0')

    act(() => img()!.dispatchEvent(new Event('load')))
    expect(artworkLoading()).toBeNull()
    expect(container.querySelector('[data-testid="loading-slot"]')).toBeNull()
    expect(img()?.className).toContain('scale-100')
    expect(img()?.className).toContain('opacity-100')
  })

  it('never renders loadingSlot when cover is absent or failed', () => {
    render({
      cover: undefined,
      loadingSlot: <span data-testid="loading-slot">封面加载中…</span>,
    })
    expect(artworkLoading()).toBeNull()
    expect(container.querySelector('[data-testid="loading-slot"]')).toBeNull()
    expect(fallback()).not.toBeNull()
  })

  it('uses a static glass surface instead of animated sheen under prefers-reduced-motion', () => {
    mockMatchMedia(true)
    render({ cover: 'https://cdn.test/a.jpg' })
    expect(artworkShimmer()?.getAttribute('data-reduced-motion')).toBe('true')
    expect(artworkShimmer()?.className).not.toContain('-skew-x-12')
  })
})
