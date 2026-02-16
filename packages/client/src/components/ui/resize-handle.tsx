import { useCallback, useEffect, useRef } from 'react'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ResizeHandleProps {
  /** Called continuously during drag with the horizontal pixel delta (negative = moving left) */
  onResize: (delta: number) => void
  /** Called once when drag ends, for snap logic */
  onResizeEnd?: () => void
  /** Whether the adjacent panel is collapsed (width === 0) */
  collapsed?: boolean
  /** Double-click restores default width */
  onDoubleClick?: () => void
}

export function ResizeHandle({
  onResize,
  onResizeEnd,
  collapsed = false,
  onDoubleClick,
}: ResizeHandleProps) {
  const isDragging = useRef(false)
  const lastX = useRef(0)
  const moveHandlerRef = useRef<((e: PointerEvent) => void) | null>(null)
  const upHandlerRef = useRef<(() => void) | null>(null)

  // Cleanup document listeners on unmount (safety net for mid-drag unmount)
  useEffect(() => {
    return () => {
      if (moveHandlerRef.current) document.removeEventListener('pointermove', moveHandlerRef.current)
      if (upHandlerRef.current) document.removeEventListener('pointerup', upHandlerRef.current)
      if (isDragging.current) {
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        isDragging.current = false
      }
    }
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      isDragging.current = true
      lastX.current = e.clientX

      // Lock cursor and disable text selection during drag
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (!isDragging.current) return
        const delta = moveEvent.clientX - lastX.current
        lastX.current = moveEvent.clientX
        onResize(delta)
      }

      const handlePointerUp = () => {
        isDragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('pointermove', handlePointerMove)
        document.removeEventListener('pointerup', handlePointerUp)
        moveHandlerRef.current = null
        upHandlerRef.current = null
        onResizeEnd?.()
      }

      moveHandlerRef.current = handlePointerMove
      upHandlerRef.current = handlePointerUp
      document.addEventListener('pointermove', handlePointerMove)
      document.addEventListener('pointerup', handlePointerUp)
    },
    [onResize, onResizeEnd],
  )

  const handleDoubleClick = useCallback(() => {
    onDoubleClick?.()
  }, [onDoubleClick])

  return (
    <div
      className={cn(
        'group relative flex shrink-0 cursor-col-resize items-center justify-center transition-colors',
        collapsed ? 'w-2 bg-border hover:bg-primary/50' : 'w-1 hover:bg-primary/50',
      )}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
    >
      {/* Visual grip indicator on hover */}
      <div
        className={cn(
          'absolute inset-y-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100',
          collapsed ? 'w-2' : 'w-4 -left-1.5',
        )}
      >
        {collapsed ? (
          <div className="h-8 w-1 rounded-full bg-primary/60" />
        ) : (
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
    </div>
  )
}
