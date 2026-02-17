import { useCallback, useRef, useState } from 'react'

export function useContainerPortrait() {
  const [isPortrait, setIsPortrait] = useState(false)
  const observerRef = useRef<ResizeObserver | null>(null)

  const ref = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (node) {
      const rect = node.getBoundingClientRect()
      setIsPortrait(rect.height > rect.width)
      const ro = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect
        setIsPortrait(height > width)
      })
      ro.observe(node)
      observerRef.current = ro
    }
  }, [])

  return { ref, isPortrait }
}
