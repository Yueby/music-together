import { useCallback, useState } from 'react'

/**
 * `[ref, seen]`: `seen` turns true once the element has come within `margin` of the viewport, and stays true. Lets a long
 * list defer expensive per-item work (loading artwork) until the item is about to be scrolled to. Without
 * IntersectionObserver everything counts as seen.
 */
export function useInView<T extends Element>(margin = '200px') {
  const [seen, setSeen] = useState(false)
  const ref = useCallback(
    (node: T | null) => {
      if (!node) return
      if (typeof IntersectionObserver === 'undefined') {
        setSeen(true)
        return
      }
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setSeen(true)
            observer.disconnect()
          }
        },
        { rootMargin: margin },
      )
      observer.observe(node)
      return () => observer.disconnect()
    },
    [margin],
  )
  return [ref, seen] as const
}
