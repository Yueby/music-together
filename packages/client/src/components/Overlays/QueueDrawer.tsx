import { ArtistNames } from '@/components/ArtistNames'
import { ArtworkImage } from '@/components/ArtworkImage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { usePlayerStore } from '@/stores/playerStore'
import { canSendRoomCommand, useRoomStore } from '@/stores/roomStore'
import { useSocketContext } from '@/providers/SocketProvider'
import type { Track } from '@music-together/shared'
import { EVENTS } from '@music-together/shared'
import { useHasHover } from '@/hooks/useHasHover'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { defaultRangeExtractor, useVirtualizer, type Range } from '@tanstack/react-virtual'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAppAbility } from '@/providers/AbilityProvider'
import { ArrowUpToLine, ChevronDown, ChevronUp, GripVertical, ListX, Music, Play, Trash2, User, X } from 'lucide-react'
import { toast } from 'sonner'
import { MarqueeText } from '@/components/ui/marquee-text'
import type { MusicSource } from '@music-together/shared'

const EMPTY_QUEUE: Track[] = []

const SOURCE_STYLE: Record<MusicSource, { label: string; className: string }> = {
  netease: { label: '网易', className: 'text-white bg-red-500 ring-red-600/50' },
  tencent: { label: 'QQ', className: 'text-white bg-green-500 ring-green-600/50' },
  kugou: { label: '酷狗', className: 'text-white bg-blue-500 ring-blue-600/50' },
}

/** Cover thumbnail, with the music icon whenever there is no usable image. */
export function QueueCover({ track }: { track: Track }) {
  return (
    <ArtworkImage
      cover={track.thumbnailCover ?? track.cover}
      alt={track.title}
      fallback={<Music className="h-4 w-4 text-muted-foreground" />}
      className="h-9 w-9 rounded"
    />
  )
}

interface QueueDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRemoveFromQueue: (trackId: string) => void
  onReorderQueue: (trackIds: string[]) => void
  onClearQueue: () => void
}

interface SortableQueueRowProps {
  track: Track
  index: number
  queueLength: number
  virtualStart: number
  virtualSize: number
  isCurrent: boolean
  isTouch: boolean
  isActiveToolbar: boolean
  isHoverDismissed: boolean
  canPlay: boolean
  canVote: boolean
  canReorder: boolean
  canRemove: boolean
  isDragEnabled: boolean
  onToggleTouchToolbar: (trackId: string) => void
  onClearDismissedHover: (trackId: string) => void
  onPlayTrack: (track: Track) => void
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  onInsertAfterCurrent: (track: Track, e?: MouseEvent) => void
  onRemoveTrack: (track: Track) => void
}

function SortableQueueRow({
  track,
  index,
  queueLength,
  virtualStart,
  virtualSize,
  isCurrent,
  isTouch,
  isActiveToolbar,
  isHoverDismissed,
  canPlay,
  canVote,
  canReorder,
  canRemove,
  isDragEnabled,
  onToggleTouchToolbar,
  onClearDismissedHover,
  onPlayTrack,
  onMoveUp,
  onMoveDown,
  onInsertAfterCurrent,
  onRemoveTrack,
}: SortableQueueRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: track.id,
    disabled: !isDragEnabled,
  })

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: `${virtualSize}px`,
        transform: `translateY(${virtualStart}px)`,
        paddingTop: '8px', // To simulate the top padding/gap
        zIndex: isDragging ? 30 : undefined,
      }}
    >
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
        }}
        className={cn(
          'group relative flex h-full items-center gap-2 rounded-lg px-2 transition-colors hover:bg-accent/50',
          isCurrent && 'bg-primary/10',
          isDragging && 'opacity-40 ring-1 ring-primary/30',
        )}
        onClick={() => {
          if (isTouch) {
            onToggleTouchToolbar(track.id)
          }
        }}
        onMouseLeave={() => {
          if (!isTouch && isHoverDismissed) onClearDismissedHover(track.id)
        }}
      >
        {/* Drag handle — shown only when user can reorder and there are multiple tracks */}
        {isDragEnabled && (
          <button
            ref={setActivatorNodeRef}
            type="button"
            data-vaul-no-drag=""
            className="touch-none -ml-1 flex h-10 w-6 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing sm:h-8 sm:w-5"
            aria-label={`拖动排序 ${track.title}`}
            onClick={(e) => e.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Index */}
        <span className="w-5 shrink-0 text-center text-xs tabular-nums text-muted-foreground">{index + 1}</span>

        {/* Cover + source badge */}
        <div className="relative shrink-0">
          <QueueCover track={track} />
          {track.source && SOURCE_STYLE[track.source] && (
            <span
              className={cn(
                'absolute -bottom-1 -right-1 rounded px-0.5 text-[8px] font-bold leading-tight ring-1',
                SOURCE_STYLE[track.source].className,
              )}
            >
              {SOURCE_STYLE[track.source].label}
            </span>
          )}
        </div>

        {/* Track info */}
        <div className="min-w-0 flex-1">
          <MarqueeText className={cn('text-sm', isCurrent && 'font-medium text-primary')}>{track.title}</MarqueeText>
          <MarqueeText className="text-xs text-muted-foreground">
            <ArtistNames track={track} />
          </MarqueeText>
        </div>

        {/* Requester badge — absolute top-right inside item */}
        {track.requestedBy && (
          <Badge
            variant="outline"
            className="absolute right-2 top-1.5 z-10 h-4 gap-0.5 border-primary/30 bg-primary/10 px-1.5 py-0 text-[10px] font-normal text-primary"
          >
            <User className="h-2.5 w-2.5" />
            {track.requestedBy}
          </Badge>
        )}

        {/* Actions — visible on hover (desktop) or tap (mobile); suppressed while dragging */}
        <div
          className={cn(
            'absolute right-1 top-1/2 z-20 flex -translate-y-1/2 items-center gap-0.5',
            'rounded-md border border-border/50 bg-popover px-1 py-0.5 shadow-md backdrop-blur-md',
            'opacity-0 pointer-events-none transition-opacity',
            !isDragging && 'group-hover:opacity-100 group-hover:pointer-events-auto',
            !isDragging && 'group-focus-within:opacity-100 group-focus-within:pointer-events-auto',
            !isDragging && isTouch && isActiveToolbar && 'opacity-100 pointer-events-auto',
            !isTouch && isHoverDismissed && 'opacity-0 pointer-events-none',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Play button — hidden for currently playing track */}
          {!isCurrent && (canPlay || canVote) && (
            <Tooltip delayDuration={400}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 min-h-9 min-w-9 sm:min-h-0 sm:min-w-0"
                  onClick={() => onPlayTrack(track)}
                  aria-label={canPlay ? `播放 ${track.title}` : `投票播放 ${track.title}`}
                >
                  <Play className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{canPlay ? '播放' : '投票播放'}</TooltipContent>
            </Tooltip>
          )}

          {canReorder && (
            <>
              <Tooltip delayDuration={400}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 min-h-9 min-w-9 sm:min-h-0 sm:min-w-0"
                    disabled={index === 0}
                    onClick={() => onMoveUp(index)}
                    aria-label={`上移 ${track.title}`}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">上移</TooltipContent>
              </Tooltip>

              <Tooltip delayDuration={400}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 min-h-9 min-w-9 sm:min-h-0 sm:min-w-0"
                    disabled={index === queueLength - 1}
                    onClick={() => onMoveDown(index)}
                    aria-label={`下移 ${track.title}`}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">下移</TooltipContent>
              </Tooltip>

              <Tooltip delayDuration={400}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 min-h-9 min-w-9 sm:min-h-0 sm:min-w-0"
                    onClick={(e) => onInsertAfterCurrent(track, e)}
                    aria-label={`置顶 ${track.title}`}
                  >
                    <ArrowUpToLine className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">置顶到当前播放下方</TooltipContent>
              </Tooltip>
            </>
          )}

          {(canRemove || canVote) && (
            <Tooltip delayDuration={400}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 min-h-9 min-w-9 sm:min-h-0 sm:min-w-0 text-destructive hover:text-destructive"
                  onClick={() => onRemoveTrack(track)}
                  aria-label={canRemove ? `移除 ${track.title}` : `投票移除 ${track.title}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{canRemove ? '移除' : '投票移除'}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  )
}

export function QueueDrawer({ open, onOpenChange, onRemoveFromQueue, onReorderQueue, onClearQueue }: QueueDrawerProps) {
  const queue = useRoomStore((s) => s.room?.queue ?? EMPTY_QUEUE)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const { socket } = useSocketContext()
  const isMobile = useIsMobile() // layout: Drawer direction, height
  const hasHover = useHasHover() // interaction: hover vs touch
  const isTouch = !hasHover
  const ability = useAppAbility()
  const canRemove = ability.can('remove', 'Queue')
  const canReorder = ability.can('reorder', 'Queue')
  const canPlay = ability.can('play', 'Player')
  const canVote = ability.can('vote', 'Player')
  const isDragEnabled = canReorder && queue.length > 1
  const [confirmClear, setConfirmClear] = useState(false)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Mobile: track which item has its action toolbar visible
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null)
  // Desktop: after clicking an action, temporarily suppress the hover toolbar until the cursor leaves the item
  const [dismissedHoverTrackId, setDismissedHoverTrackId] = useState<string | null>(null)

  const queueIds = useMemo(() => queue.map((t) => t.id), [queue])
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const activeDragIndex = useMemo(
    () => (activeDragId ? queueIds.indexOf(activeDragId) : -1),
    [activeDragId, queueIds],
  )
  const activeDragTrack = activeDragIndex >= 0 ? queue[activeDragIndex] ?? null : null

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveTrackId(null)
    setActiveDragId(String(event.active.id))
  }, [])

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null)
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = queueIds.indexOf(String(active.id))
      const newIndex = queueIds.indexOf(String(over.id))
      if (oldIndex < 0 || newIndex < 0) return
      onReorderQueue(arrayMove(queueIds, oldIndex, newIndex))
    },
    [queueIds, onReorderQueue],
  )

  const handleToggleTouchToolbar = useCallback((trackId: string) => {
    setActiveTrackId((prev) => (prev === trackId ? null : trackId))
  }, [])

  const handleClearDismissedHover = useCallback((trackId: string) => {
    setDismissedHoverTrackId((prev) => (prev === trackId ? null : prev))
  }, [])

  const rangeExtractor = useCallback(
    (range: Range) => {
      const indices = defaultRangeExtractor(range)
      if (activeDragIndex >= 0 && activeDragIndex < queue.length && !indices.includes(activeDragIndex)) {
        return [...indices, activeDragIndex].sort((a, b) => a - b)
      }
      return indices
    },
    [activeDragIndex, queue.length],
  )

  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null)
  const virtualizer = useVirtualizer({
    count: queue.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => 56,
    overscan: 5,
    rangeExtractor,
  })

  // Clear the confirm-dismiss timer on unmount
  useEffect(
    () => () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    },
    [],
  )

  const handleClear = useCallback(() => {
    if (!confirmClear) {
      setConfirmClear(true)
      // Auto-dismiss after 3s
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
      confirmTimerRef.current = setTimeout(() => {
        confirmTimerRef.current = null
        setConfirmClear(false)
      }, 3000)
      return
    }
    if (confirmTimerRef.current) {
      clearTimeout(confirmTimerRef.current)
      confirmTimerRef.current = null
    }
    onClearQueue()
    setConfirmClear(false)
    toast.success('播放列表已清空')
  }, [confirmClear, onClearQueue])

  const handleMoveUp = (index: number) => {
    if (index <= 0) return
    const ids = queue.map((t) => t.id)
    ;[ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]
    onReorderQueue(ids)
  }

  const handleMoveDown = (index: number) => {
    if (index >= queue.length - 1) return
    const ids = queue.map((t) => t.id)
    ;[ids[index], ids[index + 1]] = [ids[index + 1], ids[index]]
    onReorderQueue(ids)
  }

  const handlePlayTrack = (track: Track) => {
    if (!canSendRoomCommand(socket)) return
    if (canPlay) {
      socket.emit(EVENTS.PLAYER_PLAY, { track })
    } else if (canVote) {
      socket.emit(EVENTS.VOTE_START, {
        action: 'play-track' as const,
        payload: { trackId: track.id, trackTitle: track.title },
      })
      toast.info(`已发起投票：播放「${track.title}」`)
    }
  }

  const handleRemoveTrack = (track: Track) => {
    if (!canSendRoomCommand(socket)) return
    if (canRemove) {
      onRemoveFromQueue(track.id)
      toast.success(`已移除「${track.title}」`)
    } else if (canVote) {
      socket.emit(EVENTS.VOTE_START, {
        action: 'remove-track' as const,
        payload: { trackId: track.id, trackTitle: track.title },
      })
      toast.info(`已发起投票：移除「${track.title}」`)
    }
  }

  const handleInsertAfterCurrent = (track: Track, e?: MouseEvent) => {
    // If this was triggered from inside the floating actions, hide it immediately.
    // - Touch: activeTrackId controls visibility
    // - Desktop: group-hover/group-focus-within can keep it visible after DOM reorders (transform keeps hover)
    if (e) {
      e.stopPropagation()
      ;(e.currentTarget as HTMLButtonElement | null)?.blur()
    }
    if (isTouch && activeTrackId === track.id) setActiveTrackId(null)
    if (!isTouch) setDismissedHoverTrackId(track.id)
    const current = currentTrack
    const currentIndex = current?.id ? queue.findIndex((t) => t.id === current.id) : -1

    if (current && track.id === current.id) return

    const ids = queue.map((t) => t.id)
    const from = ids.indexOf(track.id)
    if (from < 0) return

    // 先移除再插入，避免重复
    ids.splice(from, 1)

    if (currentIndex >= 0) {
      // 目标位置：当前播放歌曲的下方（已播放的在上方，不动）
      // 如果被移动的歌曲在 current 之前，移除后 currentIndex 会左移一位
      const adjustedCurrentIndex = from < currentIndex ? currentIndex - 1 : currentIndex
      const to = adjustedCurrentIndex + 1
      ids.splice(to, 0, track.id)
    } else {
      // 无 currentTrack（或 currentTrack 不在队列中）时，退化为置顶到队首
      ids.unshift(track.id)
    }

    onReorderQueue(ids)
    toast.success(`已置顶「${track.title}」`)
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction={isMobile ? 'bottom' : 'right'}>
      <DrawerContent className={cn('flex flex-col p-0', isMobile && 'h-[calc(var(--app-dvh)*0.7)]')}>
        <DrawerHeader className="shrink-0 border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <DrawerTitle className="flex items-center gap-2 text-base">
              <Music className="h-4 w-4" />
              播放列表 ({queue.length})
            </DrawerTitle>
            <div className="flex items-center gap-1">
              {canRemove && queue.length > 0 && (
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn('h-7 w-7', confirmClear && 'text-destructive hover:text-destructive')}
                      onClick={handleClear}
                      aria-label="清空播放列表"
                    >
                      <ListX className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{confirmClear ? '再次点击确认清空' : '清空播放列表'}</TooltipContent>
                </Tooltip>
              )}
              {!isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onOpenChange(false)}
                  aria-label="关闭播放列表"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </DrawerHeader>

        <div ref={setScrollElement} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2">
          {queue.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">播放列表为空</div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext items={queueIds} strategy={verticalListSortingStrategy}>
                <div className="w-full" style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const i = virtualRow.index
                    const track = queue[i]
                    if (!track) return null
                    return (
                      <SortableQueueRow
                        key={track.id}
                        track={track}
                        index={i}
                        queueLength={queue.length}
                        virtualStart={virtualRow.start}
                        virtualSize={virtualRow.size}
                        isCurrent={currentTrack?.id === track.id}
                        isTouch={isTouch}
                        isActiveToolbar={activeTrackId === track.id}
                        isHoverDismissed={dismissedHoverTrackId === track.id}
                        canPlay={canPlay}
                        canVote={canVote}
                        canReorder={canReorder}
                        canRemove={canRemove}
                        isDragEnabled={isDragEnabled}
                        onToggleTouchToolbar={handleToggleTouchToolbar}
                        onClearDismissedHover={handleClearDismissedHover}
                        onPlayTrack={handlePlayTrack}
                        onMoveUp={handleMoveUp}
                        onMoveDown={handleMoveDown}
                        onInsertAfterCurrent={handleInsertAfterCurrent}
                        onRemoveTrack={handleRemoveTrack}
                      />
                    )
                  })}
                </div>
              </SortableContext>
              {typeof document !== 'undefined' &&
                createPortal(
                  <DragOverlay dropAnimation={null} zIndex={60}>
                    {activeDragTrack && (
                      <div
                        data-testid="queue-drag-overlay"
                        className="flex h-12 items-center gap-2 rounded-lg border border-primary/30 bg-popover/95 px-2 shadow-xl backdrop-blur-md"
                      >
                        <span className="-ml-1 flex h-8 w-5 shrink-0 items-center justify-center text-muted-foreground">
                          <GripVertical className="h-3.5 w-3.5" />
                        </span>
                        <span className="w-5 shrink-0 text-center text-xs tabular-nums text-muted-foreground">
                          {activeDragIndex + 1}
                        </span>
                        <div className="relative shrink-0">
                          <QueueCover track={activeDragTrack} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{activeDragTrack.title}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            <ArtistNames track={activeDragTrack} />
                          </div>
                        </div>
                      </div>
                    )}
                  </DragOverlay>,
                  document.body,
                )}
            </DndContext>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
