// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMediaQuery } from './useMediaQuery'

let listeners: Array<() => void> = []
let matching = false

let latest: boolean
function Probe({ query }: { query: string }) {
  const value = useMediaQuery(query)
  useEffect(() => {
    latest = value
  })
  return null
}

let root: ReturnType<typeof createRoot>
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  listeners = []
  matching = false
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return matching
    },
    media: query,
    addEventListener: (_: string, listener: () => void) => listeners.push(listener),
    removeEventListener: (_: string, listener: () => void) => {
      listeners = listeners.filter((candidate) => candidate !== listener)
    },
  }))
  root = createRoot(document.createElement('div'))
})
afterEach(() => {
  act(() => root.unmount())
  vi.unstubAllGlobals()
})

describe('useMediaQuery', () => {
  it('starts with the current answer and follows changes', () => {
    matching = true
    act(() => root.render(<Probe query="(min-width: 768px)" />))
    expect(latest).toBe(true)
    matching = false
    act(() => listeners.forEach((listener) => listener()))
    expect(latest).toBe(false)
  })

  it('stops listening when the component goes away', () => {
    act(() => root.render(<Probe query="(min-width: 768px)" />))
    expect(listeners).toHaveLength(1)
    act(() => root.unmount())
    expect(listeners).toHaveLength(0)
    root = createRoot(document.createElement('div'))
  })
})
