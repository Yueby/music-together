import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { useHasHover } from '@/hooks/useHasHover'
import { hostRuntime } from '@/lib/hostRuntime'
import { cn } from '@/lib/utils'
import { useServerStatusStore } from '@/stores/serverStatusStore'
import type { ServerCapacityStatus, ServerLoadLevel } from '@music-together/shared'
import { AlertTriangle, Clock, Radio, Users } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'

export interface ServerLoadMeta {
  label: string
  longLabel: string
  dotClass: string
  barClass: string
  percentClass: string
  triggerTextClass: string
  pulse?: boolean
}

const LEVEL_META: Record<ServerLoadLevel, ServerLoadMeta> = {
  normal: {
    label: '流畅',
    longLabel: '服务器流畅',
    dotClass: 'bg-emerald-500',
    barClass: 'bg-emerald-500',
    percentClass: 'text-emerald-400',
    triggerTextClass: 'text-muted-foreground hover:text-foreground',
  },
  busy: {
    label: '繁忙',
    longLabel: '服务器繁忙',
    dotClass: 'bg-amber-500',
    barClass: 'bg-amber-500',
    percentClass: 'text-amber-400',
    triggerTextClass: 'text-amber-400 hover:text-amber-300',
  },
  full: {
    label: '满载',
    longLabel: '服务器满载',
    dotClass: 'bg-destructive',
    barClass: 'bg-destructive',
    percentClass: 'text-destructive',
    triggerTextClass: 'text-destructive hover:text-destructive/90',
    pulse: true,
  },
}

export function getEffectiveServerLoad(capacity: ServerCapacityStatus): {
  level: ServerLoadLevel
  remaining: number
  mappOnlyCongested: boolean
  meta: ServerLoadMeta
  titleText: string
  pct: number
} {
  const isMapp = hostRuntime.kind === 'mapp'
  const level = isMapp ? capacity.mappLevel : capacity.level
  const remaining = isMapp ? capacity.estimatedMappRemaining : capacity.estimatedWebRemaining
  const mappOnlyCongested = isMapp && capacity.mappLevel !== capacity.level && capacity.mappLevel !== 'normal'
  const meta = LEVEL_META[level]
  const titleText = mappOnlyCongested ? '微应用音频中转繁忙' : meta.longLabel
  const rawPct = isMapp ? (capacity.mappPressurePercent ?? capacity.pressurePercent) : capacity.pressurePercent
  const pct = Math.min(100, Math.max(0, rawPct))

  return { level, remaining, mappOnlyCongested, meta, titleText, pct }
}

/**
 * Shared touch/hover dual-mode Popover state via `useHasHover()`:
 * desktop pointers get hover preview + click-to-pin, while touch devices use tap toggle.
 */
export function useHoverPopover() {
  const hasHover = useHasHover()
  const [open, setOpen] = useState(false)
  const pinnedRef = useRef(false)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }, [])

  useEffect(() => clearHoverTimer, [clearHoverTimer])

  useEffect(() => {
    if (!hasHover) {
      clearHoverTimer()
    }
  }, [hasHover, clearHoverTimer])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      clearHoverTimer()
      pinnedRef.current = nextOpen
      setOpen(nextOpen)
    },
    [clearHoverTimer],
  )

  const handlePointerEnter = useCallback(
    (e: React.PointerEvent) => {
      if (!hasHover || e.pointerType === 'touch') return
      clearHoverTimer()
      if (!open) {
        hoverTimerRef.current = setTimeout(() => {
          pinnedRef.current = false
          setOpen(true)
        }, 160)
      }
    },
    [hasHover, open, clearHoverTimer],
  )

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent) => {
      if (!hasHover || e.pointerType === 'touch') return
      clearHoverTimer()
      if (!pinnedRef.current) {
        hoverTimerRef.current = setTimeout(() => {
          setOpen(false)
        }, 140)
      }
    },
    [hasHover, clearHoverTimer],
  )

  const handleTriggerClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (hasHover && open && !pinnedRef.current) {
        e.preventDefault()
        pinnedRef.current = true
      }
    },
    [hasHover, open],
  )

  return {
    hasHover,
    open,
    handleOpenChange,
    handlePointerEnter,
    handlePointerLeave,
    handleTriggerClick,
  }
}

/**
 * Shared server capacity breakdown rendered inside both the lobby inline status popover
 * and the room header's unified connection + server status popover.
 */
export function ServerStatusPopoverContent({ capacity }: { capacity: ServerCapacityStatus }) {
  const prefersReducedMotion = useReducedMotion()
  const { remaining, meta, titleText, pct } = getEffectiveServerLoad(capacity)

  return (
    <div className="space-y-3">
      {/* Header + load bar + live metrics */}
      <div className="space-y-2.5">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
              <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', meta.dotClass)} />
              <span className="truncate">{titleText}</span>
            </span>
            <span className={cn('shrink-0 text-xs font-medium tabular-nums', meta.percentClass)}>{pct}%</span>
          </div>

          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <motion.div
              className={cn('h-full rounded-full', meta.barClass)}
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.35, ease: 'easeOut' }}
            />
          </div>
        </div>

        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span>在线人数</span>
            </span>
            <span className="font-medium tabular-nums text-foreground">{capacity.onlineUsers} 人</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Radio className="h-3.5 w-3.5 shrink-0" />
              <span>活跃房间</span>
            </span>
            <span className="font-medium tabular-nums text-foreground">{capacity.activeRooms} 个</span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Headroom & notices */}
      <div className="space-y-1.5 text-xs">
        <p className="tabular-nums text-muted-foreground">
          {remaining > 0 ? `预计还可加入约 ${remaining} 人` : '当前承载已满，新进入需排队等候'}
        </p>

        {capacity.queueLength > 0 && (
          <p className="flex items-center gap-1.5 text-amber-400 tabular-nums">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>当前有 {capacity.queueLength} 人正在排队</span>
          </p>
        )}

        {capacity.createRestricted && (
          <p className="flex items-start gap-1.5 text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="leading-relaxed">高负载保护中：暂限新建房间，可加入现有房间</span>
          </p>
        )}
      </div>
    </div>
  )
}

interface ServerLoadBadgeProps {
  className?: string
}

/**
 * Lightweight, borderless server capacity trigger placed inline in the lobby's
 * active rooms section header. Uses `useHoverPopover()` for touch/hover dual-mode.
 */
export function ServerLoadBadge({ className }: ServerLoadBadgeProps) {
  const capacity = useServerStatusStore((s) => s.capacity)
  const prefersReducedMotion = useReducedMotion()
  const { hasHover, open, handleOpenChange, handlePointerEnter, handlePointerLeave, handleTriggerClick } =
    useHoverPopover()

  if (!capacity) return null

  const { level, meta, titleText } = getEffectiveServerLoad(capacity)
  const ariaLabel = `${titleText}，当前 ${capacity.onlineUsers} 人在线${capacity.queueLength > 0 ? `，${capacity.queueLength} 人排队` : ''}`

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          data-testid="server-load-badge"
          data-load-level={level}
          onPointerEnter={hasHover ? handlePointerEnter : undefined}
          onPointerLeave={hasHover ? handlePointerLeave : undefined}
          onClick={handleTriggerClick}
          className={cn(
            '-my-1.5 inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-md py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:my-0 sm:min-h-0 sm:py-0',
            className,
          )}
        >
          <span
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-accent/50',
              meta.triggerTextClass,
            )}
          >
            <span
              aria-hidden
              className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full',
                meta.dotClass,
                meta.pulse && !prefersReducedMotion && 'animate-pulse motion-reduce:animate-none',
              )}
            />
            <span className="font-medium">{meta.label}</span>
            <span className="text-muted-foreground/45" aria-hidden>
              ·
            </span>
            {capacity.queueLength > 0 ? (
              <>
                <span className="tabular-nums">{capacity.onlineUsers} 人</span>
                <span className="tabular-nums text-amber-400">· 排队 {capacity.queueLength}</span>
              </>
            ) : (
              <span className="tabular-nums">
                {capacity.onlineUsers} 人<span className="hidden sm:inline">在线</span>
              </span>
            )}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={8}
        collisionPadding={12}
        onPointerEnter={hasHover ? handlePointerEnter : undefined}
        onPointerLeave={hasHover ? handlePointerLeave : undefined}
        className="w-64"
      >
        <ServerStatusPopoverContent capacity={capacity} />
      </PopoverContent>
    </Popover>
  )
}
