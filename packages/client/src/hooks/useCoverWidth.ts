import { useCallback, useRef, useState } from 'react'

/**
 * Measures the minimum dimension (min of width/height) of a container element.
 * Used to constrain sibling elements (info bar, controls) to match cover width.
 *
 * @param paused - When true, stops updating the width (e.g. during lyric mode
 *   where the container shrinks to compact height and would produce a misleading value).
 */
export function useCoverWidth(paused: boolean) {
  const [width, setWidth] = useState(0)
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const observerRef = useRef<ResizeObserver | null>(null)

  const ref = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!node) return

    const update = (w: number, h: number) => {
      if (!pausedRef.current) setWidth(Math.floor(Math.min(w, h)))
    }

    const rect = node.getBoundingClientRect()
    update(rect.width, rect.height)

    const ro = new ResizeObserver(([entry]) => {
      update(entry.contentRect.width, entry.contentRect.height)
    })
    ro.observe(node)
    observerRef.current = ro
  }, [])

  return { ref, coverWidth: width }
}
