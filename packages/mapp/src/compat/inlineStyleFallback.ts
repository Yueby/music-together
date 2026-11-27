/**
 * The mini-app sandbox runs under a strict CSP (`style-src` without `'unsafe-inline'`), which blocks
 * `element.setAttribute('style', ...)` (inline style attributes) while allowing CSSOM writes
 * (`element.style.setProperty(...)`).
 *
 * `@applemusic-like-lyrics/core`'s interlude waiting dots (`InterludeDotsEl`) hide themselves via
 * `this.element.style.opacity = '0'` and then animate position and opacity with
 * `this.element.setAttribute('style', 'transform:...;opacity:...')`. Under strict CSP the
 * `setAttribute` call is silently dropped, leaving the dots invisible at `opacity: 0`.
 *
 * Rewriting `HTMLElement.prototype.setAttribute('style', ...)` into CSSOM `setProperty` /
 * `removeProperty` keeps third-party style updates working without relaxing CSP or touching
 * non-style attributes. Defining the wrapper on `HTMLElement.prototype` (one level below
 * `Element.prototype`) stays effective even if the platform locks `Element.prototype.setAttribute`.
 */

interface StyleDeclaration {
  property: string
  value: string
  priority: '' | 'important'
}

const IMPORTANT_SUFFIX = /\s*!important\s*$/i

function parseStyleDeclarations(styleText: string): StyleDeclaration[] {
  const declarations: StyleDeclaration[] = []
  let start = 0
  let parenDepth = 0
  let quote: '"' | "'" | null = null

  const pushSegment = (segment: string) => {
    const colon = segment.indexOf(':')
    if (colon <= 0) return
    const property = segment.slice(0, colon).trim()
    let value = segment.slice(colon + 1).trim()
    if (!property || !value) return

    let priority: '' | 'important' = ''
    if (IMPORTANT_SUFFIX.test(value)) {
      priority = 'important'
      value = value.replace(IMPORTANT_SUFFIX, '').trim()
    }
    if (!value) return

    declarations.push({
      property: property.startsWith('--') ? property : property.toLowerCase(),
      value,
      priority,
    })
  }

  for (let i = 0; i < styleText.length; i++) {
    const ch = styleText[i]
    if (quote) {
      if (ch === '\\') {
        i++
      } else if (ch === quote) {
        quote = null
      }
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
    } else if (ch === '(') {
      parenDepth++
    } else if (ch === ')' && parenDepth > 0) {
      parenDepth--
    } else if (ch === ';' && parenDepth === 0) {
      pushSegment(styleText.slice(start, i))
      start = i + 1
    }
  }

  if (start < styleText.length) {
    pushSegment(styleText.slice(start))
  }
  return declarations
}

export function installInlineStyleFallback(): () => void {
  const inherited = Object.getOwnPropertyDescriptor(Element.prototype, 'setAttribute')
  const previous = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'setAttribute')
  const delegate = (previous?.value ?? inherited?.value) as
    | ((this: HTMLElement, qualifiedName: string, value: string) => void)
    | undefined
  if (typeof delegate !== 'function') return () => {}

  Object.defineProperty(HTMLElement.prototype, 'setAttribute', {
    configurable: true,
    enumerable: inherited?.enumerable ?? true,
    writable: true,
    value(this: HTMLElement, qualifiedName: string, value: string) {
      if (typeof qualifiedName === 'string' && qualifiedName.toLowerCase() === 'style') {
        const declarations = parseStyleDeclarations(String(value ?? ''))
        // Start from an empty declaration block so an invalid value cannot retain a previous property.
        for (let i = this.style.length - 1; i >= 0; i--) {
          const existing = this.style[i]
          if (existing) this.style.removeProperty(existing)
        }

        for (const { property, value: propValue, priority } of declarations) {
          this.style.setProperty(property, propValue, priority)
        }
        return
      }
      return delegate.call(this, qualifiedName, value)
    },
  })

  return () => {
    if (previous) Object.defineProperty(HTMLElement.prototype, 'setAttribute', previous)
    else Reflect.deleteProperty(HTMLElement.prototype, 'setAttribute')
  }
}
