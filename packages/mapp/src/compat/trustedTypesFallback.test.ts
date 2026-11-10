// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installTrustedTypesFallback } from './trustedTypesFallback.ts'

const native = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')!
let platformSet: ReturnType<typeof vi.fn>
let remove: () => void

/**
 * Stand in for the platform: its setter rejects whatever it is given, and the property may be locked.
 * A property can only be locked once per realm, so later cases reuse the setter that is already in place
 * (the locked group runs last; call history is cleared between tests).
 */
function installPlatformSetter(configurable: boolean) {
  if (!Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')!.configurable) return
  platformSet = vi.fn(() => {
    throw new TypeError("This document requires 'TrustedHTML' assignment.")
  })
  Object.defineProperty(Element.prototype, 'innerHTML', {
    ...native,
    configurable,
    set: platformSet as (value: string) => void,
  })
}

describe.each([
  ['a configurable Element.prototype accessor', true],
  ['a locked (non-configurable) Element.prototype accessor, as on the platform', false],
])('installTrustedTypesFallback with %s', (_label, configurable) => {
  beforeEach(() => {
    installPlatformSetter(configurable)
    remove = installTrustedTypesFallback()
  })
  afterEach(() => {
    remove()
    document.body.replaceChildren()
  })

  it('clears an element with replaceChildren instead of an empty innerHTML assignment', () => {
    const div = document.createElement('div')
    div.append(document.createElement('span'), 'text')
    div.innerHTML = ''
    expect(div.childNodes).toHaveLength(0)
    expect(platformSet).not.toHaveBeenCalled()
  })

  it('clears a template through its content fragment', () => {
    const template = document.createElement('template')
    template.content.append(document.createElement('p'))
    template.innerHTML = ''
    expect(template.content.childNodes).toHaveLength(0)
    expect(platformSet).not.toHaveBeenCalled()
  })

  it('writes stylesheet text to a <style> element as text, never as HTML', () => {
    const style = document.createElement('style')
    style.innerHTML = '[data-x]{scrollbar-width:none}<b>not html</b>'
    expect(style.textContent).toBe('[data-x]{scrollbar-width:none}<b>not html</b>')
    expect(style.children).toHaveLength(0)
    expect(platformSet).not.toHaveBeenCalled()
  })

  it('still hands every other value to the platform setter, which keeps rejecting it', () => {
    const div = document.createElement('div')
    expect(() => {
      div.innerHTML = '<img src=x onerror=alert(1)>'
    }).toThrow('TrustedHTML')
    expect(platformSet).toHaveBeenCalledOnce()
    expect(div.childNodes).toHaveLength(0)
  })

  it('leaves reading innerHTML alone', () => {
    const div = document.createElement('div')
    div.append(document.createElement('i'))
    expect(div.innerHTML).toBe('<i></i>')
  })

  it('removes only its own accessor on removal and the platform behaviour returns', () => {
    remove()
    expect(Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerHTML')).toBeUndefined()
    expect(Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')!.set).toBe(platformSet)
    const div = document.createElement('div')
    expect(() => {
      div.innerHTML = ''
    }).toThrow('TrustedHTML')
    remove = installTrustedTypesFallback()
  })
})
