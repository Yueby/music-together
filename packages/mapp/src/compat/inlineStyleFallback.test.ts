// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installInlineStyleFallback } from './inlineStyleFallback.ts'

const nativeDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'setAttribute')!
const nativeSetAttribute = nativeDescriptor.value as (this: Element, name: string, value: string) => void
let platformSetAttribute: ReturnType<typeof vi.fn>
let remove: () => void

/**
 * Stand in for a strict-CSP platform where `setAttribute('style', ...)` is rejected,
 * tested with both configurable and non-configurable `Element.prototype.setAttribute`.
 */
function installPlatformSetAttribute(configurable: boolean) {
  if (!Object.getOwnPropertyDescriptor(Element.prototype, 'setAttribute')!.configurable) return
  platformSetAttribute = vi.fn(function (this: Element, name: string, value: string) {
    if (name.toLowerCase() === 'style') {
      throw new Error('Blocked by CSP style-src-attr')
    }
    return nativeSetAttribute.call(this, name, value)
  })
  Object.defineProperty(Element.prototype, 'setAttribute', {
    ...nativeDescriptor,
    configurable,
    value: platformSetAttribute,
  })
}

describe.each([
  ['a configurable Element.prototype.setAttribute', true],
  ['a locked Element.prototype.setAttribute', false],
])('installInlineStyleFallback with %s', (_label, configurable) => {
  beforeEach(() => {
    installPlatformSetAttribute(configurable)
    platformSetAttribute.mockClear()
    remove = installInlineStyleFallback()
  })

  afterEach(() => {
    remove()
    document.body.replaceChildren()
  })

  it('rewrites AMLL interlude dot style attributes into CSSOM setProperty calls', () => {
    const el = document.createElement('div')
    el.style.opacity = '0'

    el.setAttribute('style', 'transform:translate(12.50px, 148.25px) scale(1.1250);opacity:0.950')

    expect(platformSetAttribute).not.toHaveBeenCalled()
    expect(el.style.transform).toBe('translate(12.5px, 148.25px) scale(1.125)')
    expect(el.style.opacity).toBe('0.95')
  })

  it('removes stale properties and supports !important, custom properties, and uppercase STYLE', () => {
    const el = document.createElement('div')
    el.style.setProperty('color', 'red')
    el.style.setProperty('opacity', '0.5')

    el.setAttribute('STYLE', 'opacity: 1 !important; --amll-scale: 1.2;')

    expect(platformSetAttribute).not.toHaveBeenCalled()
    expect(el.style.getPropertyValue('color')).toBe('')
    expect(el.style.getPropertyValue('opacity')).toBe('1')
    expect(el.style.getPropertyPriority('opacity')).toBe('important')
    expect(el.style.getPropertyValue('--amll-scale')).toBe('1.2')

    el.setAttribute('style', '')
    expect(el.style.length).toBe(0)
  })

  it('delegates non-style attributes untouched to the platform setAttribute', () => {
    const el = document.createElement('div')
    el.setAttribute('data-testid', 'interlude-dots')
    el.setAttribute('class', 'FmKaba_interludeDots')

    expect(platformSetAttribute).toHaveBeenCalledTimes(2)
    expect(el.getAttribute('data-testid')).toBe('interlude-dots')
    expect(el.className).toBe('FmKaba_interludeDots')
  })

  it('discards the previous value when the replacement declaration is invalid', () => {
    const el = document.createElement('div')
    el.style.opacity = '0.5'

    el.setAttribute('style', 'opacity:abc')

    expect(platformSetAttribute).not.toHaveBeenCalled()
    expect(el.style.opacity).toBe('')
  })

  it('restores original prototype behavior on cleanup', () => {
    remove()
    expect(Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'setAttribute')).toBeUndefined()
    const el = document.createElement('div')
    expect(() => el.setAttribute('style', 'opacity: 1')).toThrow('CSP')
    remove = installInlineStyleFallback()
  })
})
