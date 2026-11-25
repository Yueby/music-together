import { useCallback, useRef, useState } from 'react'

/** Minimum container width (px) to keep the two-column cover + lyrics layout when height slightly exceeds width. */
const TWO_COLUMN_ENTER_WIDTH = 800
const TWO_COLUMN_EXIT_WIDTH = 760
/** Minimum aspect ratio (width / height) to keep the two-column layout in near-square intermediate states (e.g. desktop + chat). */
const TWO_COLUMN_ENTER_RATIO = 0.76
const TWO_COLUMN_EXIT_RATIO = 0.72

/**
 * Decide whether `AudioPlayer` should use single-column portrait layout.
 * Uses hysteresis so dragging a window or toggling the chat panel near the boundary never flickers.
 */
export function shouldUsePortraitLayout(width: number, height: number, currentPortrait: boolean): boolean {
  if (width <= 0 || height <= 0) return currentPortrait
  if (width >= height) return false

  const ratio = width / height
  if (currentPortrait) {
    // Require slightly wider room before switching back to two columns
    return !(width >= TWO_COLUMN_ENTER_WIDTH && ratio >= TWO_COLUMN_ENTER_RATIO)
  }
  // Keep two columns while there is still comfortable horizontal space for cover + lyrics
  return width < TWO_COLUMN_EXIT_WIDTH || ratio < TWO_COLUMN_EXIT_RATIO
}

export function useContainerPortrait() {
  const [isPortrait, setIsPortrait] = useState(false)
  const observerRef = useRef<ResizeObserver | null>(null)

  const ref = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (node) {
      const rect = node.getBoundingClientRect()
      setIsPortrait((prev) => shouldUsePortraitLayout(rect.width, rect.height, prev))
      const ro = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect
        setIsPortrait((prev) => shouldUsePortraitLayout(width, height, prev))
      })
      ro.observe(node)
      observerRef.current = ro
    }
  }, [])

  return { ref, isPortrait }
}
