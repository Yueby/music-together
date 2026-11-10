/**
 * The platform runs a mini-app under Trusted Types, so every `innerHTML` assignment throws, even the
 * harmless ones: the lyric renderer clears its lines with `innerHTML = ''` and Radix writes scrollbar
 * CSS into a `<style>` element. A throw there aborts the whole render and takes the interface down.
 *
 * Only the two forms that cannot parse HTML are rewritten:
 * - `''`            → `replaceChildren()` (same result, no parsing)
 * - `<style>` text  → `textContent` (stylesheet text is not HTML)
 *
 * Any other value still reaches the platform's own setter and is still rejected by Trusted Types. No policy is
 * created, nothing is parsed and nothing is swallowed.
 *
 * The accessor is defined on `HTMLElement.prototype`, one level below `Element.prototype`. The platform may
 * lock the `Element.prototype` property (non-configurable), and a locked property must not silently disable
 * this fallback; an own property on the subclass prototype is always allowed and sits first in the chain of
 * every HTML element.
 */
export function installTrustedTypesFallback(): () => void {
  const inherited = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')
  const delegate = inherited?.set
  if (!inherited || !delegate) return () => {}

  const previous = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerHTML')
  Object.defineProperty(HTMLElement.prototype, 'innerHTML', {
    configurable: true,
    enumerable: inherited.enumerable,
    get: inherited.get,
    set(this: HTMLElement, value: unknown) {
      if (value === '') {
        // A template keeps its children in a separate fragment.
        if (this instanceof HTMLTemplateElement) this.content.replaceChildren()
        else this.replaceChildren()
        return
      }
      if (this instanceof HTMLStyleElement) {
        this.textContent = String(value)
        return
      }
      delegate.call(this, value)
    },
  })

  return () => {
    if (previous) Object.defineProperty(HTMLElement.prototype, 'innerHTML', previous)
    else Reflect.deleteProperty(HTMLElement.prototype, 'innerHTML')
  }
}
