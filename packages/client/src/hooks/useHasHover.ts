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
    () => typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches,
  )

  useEffect(() => {
    const mql = window.matchMedia('(hover: hover)')
    const onChange = () => setHasHover(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return hasHover
}
