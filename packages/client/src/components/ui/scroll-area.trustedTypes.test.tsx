// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ScrollArea } from './scroll-area'

/**
 * Regression guard for strict CSP / Trusted Types sandboxes:
 * ScrollArea must not inject runtime `<style>` tags or assign `innerHTML`,
 * which previously caused TrustedHTML throws and CSP `style-src` console errors in Settings.
 */
const native = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')!
let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  Object.defineProperty(Element.prototype, 'innerHTML', {
    ...native,
    set() {
      throw new TypeError("This document requires 'TrustedHTML' assignment.")
    },
  })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container, { onUncaughtError: () => {}, onCaughtError: () => {} })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  Object.defineProperty(Element.prototype, 'innerHTML', native)
  vi.unstubAllGlobals()
})

describe('ScrollArea under strict CSP and Trusted Types', () => {
  it('commits without Trusted Types fallback and injects no runtime <style> elements', () => {
    expect(() =>
      act(() => {
        root.render(
          <ScrollArea className="min-h-0 flex-1">
            <p>member list</p>
          </ScrollArea>,
        )
      }),
    ).not.toThrow()

    expect(container.textContent).toContain('member list')
    expect(container.querySelectorAll('style')).toHaveLength(0)
    const el = container.querySelector('[data-slot="scroll-area"]')
    expect(el?.className).toContain('overflow-y-auto')
  })
})
