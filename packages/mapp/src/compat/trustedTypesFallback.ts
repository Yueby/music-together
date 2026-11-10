/**
 * The platform runs a mini-app under Trusted Types, so every `innerHTML` assignment throws, even the
 * harmless ones: the lyric renderer clears its lines with `innerHTML = ''` and Radix writes scrollbar
 * CSS into a `<style>` element. A throw there aborts the whole render (no lyrics at all).
 *
 * Only the two forms that cannot parse HTML are rewritten:
 * - `''`            → `replaceChildren()` (same result, no parsing)
 * - `<style>` text  → `textContent` (stylesheet text is not HTML)
 *
 * Any other value still reaches the native setter and is still rejected by Trusted Types. No policy is
 * created, nothing is parsed and nothing is swallowed.
 */
export function installTrustedTypesFallback(): () => void {
  const original = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')
  const nativeSet = original?.set
  if (!original || !nativeSet || !original.configurable) return () => {}

  Object.defineProperty(Element.prototype, 'innerHTML', {
    ...original,
    set(this: Element, value: unknown) {
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
      nativeSet.call(this, value)
    },
  })
  return () => {
    Object.defineProperty(Element.prototype, 'innerHTML', original)
  }
}
