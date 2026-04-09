import { useEffect, useState } from 'react'

/**
 * Detects whether the device has hover capability (mouse/trackpad).
 * Touch-only devices (phones, tablets) return false regardless of orientation.
 * Uses the W3C standard `(hover: hover)` media query (Media Queries Level 4).
 *
 * Supports hot-plug: connecting/disconnecting a mouse triggers the `change` event.
 */
export function useHasHover() {
  const [hasHover, setHasHover] = useState(
    () =>
      typeof window !== 'undefined' &&
      (window.matchMedia('(any-hover: hover)').matches || window.matchMedia('(hover: hover)').matches),
  )

  useEffect(() => {
    const mqlAnyHover = window.matchMedia('(any-hover: hover)')
    const mqlHover = window.matchMedia('(hover: hover)')
    const onChange = () => setHasHover(mqlAnyHover.matches || mqlHover.matches)
    mqlAnyHover.addEventListener('change', onChange)
    mqlHover.addEventListener('change', onChange)
    return () => {
      mqlAnyHover.removeEventListener('change', onChange)
      mqlHover.removeEventListener('change', onChange)
    }
  }, [])

  return hasHover
}
