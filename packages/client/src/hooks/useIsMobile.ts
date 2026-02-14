import { useEffect, useState } from 'react'

/**
 * Detects portrait (mobile) vs landscape (desktop) orientation.
 * Portrait = mobile layout (single column), Landscape = desktop layout (two columns).
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(orientation: portrait)').matches,
  )

  useEffect(() => {
    const mql = window.matchMedia('(orientation: portrait)')
    const onChange = () => setIsMobile(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
