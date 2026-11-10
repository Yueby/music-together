// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installTrustedTypesFallback } from './trustedTypesFallback.ts'

const native = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')!
let nativeSet: ReturnType<typeof vi.fn>
let remove: () => void

beforeEach(() => {
  // Stand in for Trusted Types: the native setter rejects anything it is given.
  nativeSet = vi.fn(() => {
    throw new TypeError("This document requires 'TrustedHTML' assignment.")
  })
  Object.defineProperty(Element.prototype, 'innerHTML', { ...native, set: nativeSet as (value: string) => void })
  remove = installTrustedTypesFallback()
})
afterEach(() => {
  remove()
  Object.defineProperty(Element.prototype, 'innerHTML', native)
  document.body.replaceChildren()
})

describe('installTrustedTypesFallback', () => {
  it('clears an element with replaceChildren instead of an empty innerHTML assignment', () => {
    const div = document.createElement('div')
    div.append(document.createElement('span'), 'text')
    div.innerHTML = ''
    expect(div.childNodes).toHaveLength(0)
    expect(nativeSet).not.toHaveBeenCalled()
  })

  it('clears a template through its content fragment', () => {
    const template = document.createElement('template')
    template.content.append(document.createElement('p'))
    template.innerHTML = ''
    expect(template.content.childNodes).toHaveLength(0)
    expect(nativeSet).not.toHaveBeenCalled()
  })

  it('writes stylesheet text to a <style> element as text, never as HTML', () => {
    const style = document.createElement('style')
    style.innerHTML = '[data-x]{scrollbar-width:none}<b>not html</b>'
    expect(style.textContent).toBe('[data-x]{scrollbar-width:none}<b>not html</b>')
    expect(style.children).toHaveLength(0)
    expect(nativeSet).not.toHaveBeenCalled()
  })

  it('still hands every other value to the native setter, which keeps rejecting it', () => {
    const div = document.createElement('div')
    expect(() => {
      div.innerHTML = '<img src=x onerror=alert(1)>'
    }).toThrow('TrustedHTML')
    expect(nativeSet).toHaveBeenCalledOnce()
    expect(div.childNodes).toHaveLength(0)
  })

  it('leaves reading innerHTML alone', () => {
    const div = document.createElement('div')
    div.append(document.createElement('i'))
    expect(div.innerHTML).toBe('<i></i>')
  })

  it('restores the previous property descriptor on removal', () => {
    const installed = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')!
    expect(installed.set).not.toBe(nativeSet)
    remove()
    expect(Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')!.set).toBe(nativeSet)
    const div = document.createElement('div')
    expect(() => {
      div.innerHTML = ''
    }).toThrow('TrustedHTML')
    remove = installTrustedTypesFallback()
  })
})
