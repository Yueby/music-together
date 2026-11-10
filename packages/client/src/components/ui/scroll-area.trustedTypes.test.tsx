// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installTrustedTypesFallback } from '../../../../mapp/src/compat/trustedTypesFallback'
import { ScrollArea } from './scroll-area'

/**
 * Regression for the platform's Trusted Types enforcement: Radix writes scrollbar CSS into a `<style>`
 * through `dangerouslySetInnerHTML`, which throws during React's commit and takes the whole tree down
 * (e.g. opening the member list). jsdom has no Trusted Types, so the native setter is replaced by one that
 * rejects every value, as the platform does.
 */
const native = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')!
let remove: (() => void) | undefined
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
  remove?.()
  remove = undefined
  Object.defineProperty(Element.prototype, 'innerHTML', native)
  vi.unstubAllGlobals()
})

const render = () =>
  act(() => {
    root.render(
      <ScrollArea>
        <p>member list</p>
      </ScrollArea>,
    )
  })

describe('Radix ScrollArea under Trusted Types', () => {
  it('fails to commit without the fallback (the platform behaviour being guarded against)', () => {
    expect(render).toThrow('TrustedHTML')
  })

  it('renders with the fallback and keeps the scrollbar CSS as style text', () => {
    remove = installTrustedTypesFallback()
    render()
    expect(container.textContent).toContain('member list')
    const css = [...container.querySelectorAll('style')].map((style) => style.textContent).join('')
    expect(css).toContain('[data-radix-scroll-area-viewport]')
  })

  it('does not widen what is allowed: HTML strings are still rejected', () => {
    remove = installTrustedTypesFallback()
    const div = document.createElement('div')
    expect(() => {
      div.innerHTML = '<b>x</b>'
    }).toThrow('TrustedHTML')
    expect(() => {
      div.innerHTML = ''
    }).not.toThrow()
  })
})
