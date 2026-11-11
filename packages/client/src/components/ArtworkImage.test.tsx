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
const fallback = () => container.querySelector('[data-testid=fallback]')
const img = () => container.querySelector('img')

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
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
})
