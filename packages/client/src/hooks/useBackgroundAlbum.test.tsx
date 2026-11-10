// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const loader = vi.hoisted(() => ({ direct: true, load: vi.fn() }))
vi.mock('@/lib/artwork', () => ({ artworkLoader: loader }))

import { useBackgroundAlbum } from './useBackgroundAlbum'

/** jsdom never loads images, so a stand-in lets each test decide when and whether they load. */
class FakeImage {
  static instances: FakeImage[] = []
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  src = ''
  constructor() {
    FakeImage.instances.push(this)
  }
  finishLoading() {
    this.onload?.()
  }
  fail() {
    this.onerror?.()
  }
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
let seen: (string | HTMLImageElement | undefined)[]
const lastSeen = () => seen[seen.length - 1]

function Probe({ src, hasCover = src !== undefined }: { src?: string; hasCover?: boolean }) {
  seen.push(useBackgroundAlbum(src, hasCover))
  return null
}
const render = (src?: string, hasCover?: boolean) => act(() => root.render(<Probe src={src} hasCover={hasCover} />))

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('Image', FakeImage)
  FakeImage.instances = []
  seen = []
  loader.direct = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('useBackgroundAlbum', () => {
  it('passes the URL straight through on Web, without creating an image', () => {
    render('https://example.com/a.jpg')
    expect(lastSeen()).toBe('https://example.com/a.jpg')
    expect(FakeImage.instances).toHaveLength(0)
    render(undefined)
    expect(lastSeen()).toBeUndefined()
  })

  describe('host that reads the bytes', () => {
    beforeEach(() => {
      loader.direct = false
    })

    it('returns nothing until the image has loaded, then the element itself (never a string)', () => {
      render('blob:a')
      expect(lastSeen()).toBeUndefined()
      expect(FakeImage.instances[0].src).toBe('blob:a')
      act(() => FakeImage.instances[0].finishLoading())
      expect(lastSeen()).toBe(FakeImage.instances[0])
    })

    it('keeps the previous cover while the next one loads, then switches, ignoring a late load of the old one', () => {
      render('blob:a')
      const first = FakeImage.instances[0]
      act(() => first.finishLoading())
      // The next cover is still being read from the host: the track has a cover but no address yet.
      render(undefined, true)
      expect(lastSeen()).toBe(first)
      render('blob:b')
      expect(lastSeen()).toBe(first)
      act(() => first.finishLoading())
      expect(lastSeen()).toBe(first)
      act(() => FakeImage.instances[1].finishLoading())
      expect(lastSeen()).toBe(FakeImage.instances[1])
    })

    it('drops the background for a track without a cover', () => {
      render('blob:a')
      act(() => FakeImage.instances[0].finishLoading())
      render(undefined, false)
      expect(lastSeen()).toBeUndefined()
    })

    it('clears the background when the new cover fails to load, instead of showing another song', () => {
      render('blob:a')
      act(() => FakeImage.instances[0].finishLoading())
      render('blob:broken')
      act(() => FakeImage.instances[1].fail())
      expect(lastSeen()).toBeUndefined()
    })

    it('ignores a failure of a cover that is no longer current', () => {
      render('blob:a')
      act(() => FakeImage.instances[0].finishLoading())
      render('blob:b')
      const second = FakeImage.instances[1]
      render('blob:c')
      act(() => second.fail())
      expect(lastSeen()).toBe(FakeImage.instances[0])
    })

    it('does not create an image without a source', () => {
      render(undefined)
      expect(FakeImage.instances).toHaveLength(0)
      expect(lastSeen()).toBeUndefined()
    })
  })
})
