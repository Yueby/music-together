// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useInView } from './useInView'

interface FakeObserver {
  callback: IntersectionObserverCallback
  options?: IntersectionObserverInit
  observe: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}
const observers: FakeObserver[] = []

function Probe() {
  const [ref, seen] = useInView<HTMLDivElement>('50px')
  return <div ref={ref} data-seen={String(seen)} />
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  observers.length = 0
  container = document.createElement('div')
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  vi.unstubAllGlobals()
})

const seen = () => container.firstElementChild?.getAttribute('data-seen')
const intersect = (isIntersecting: boolean) =>
  act(() => observers[0].callback([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver))

describe('useInView', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
          const fake: FakeObserver = { callback, options, observe: vi.fn(), disconnect: vi.fn() }
          observers.push(fake)
          return Object.assign(this, fake)
        }
      },
    )
  })

  it('turns true once the element is near the viewport, then stops watching', () => {
    act(() => root.render(<Probe />))
    expect(seen()).toBe('false')
    expect(observers[0].options).toEqual({ rootMargin: '50px' })
    intersect(false)
    expect(seen()).toBe('false')
    intersect(true)
    expect(seen()).toBe('true')
    expect(observers[0].disconnect).toHaveBeenCalled()
  })

  it('stops watching when the element goes away', () => {
    act(() => root.render(<Probe />))
    act(() => root.unmount())
    expect(observers[0].disconnect).toHaveBeenCalled()
    root = createRoot(container)
  })

  it('counts everything as seen where IntersectionObserver is missing', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    act(() => root.render(<Probe />))
    expect(seen()).toBe('true')
  })
})
