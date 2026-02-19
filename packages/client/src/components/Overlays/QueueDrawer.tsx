import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { usePlayerStore } from '@/stores/playerStore'
import { useRoomStore } from '@/stores/roomStore'
import { useSocketContext } from '@/providers/SocketProvider'
import type { Track } from '@music-together/shared'
import { EVENTS } from '@music-together/shared'
import { useHasHover } from '@/hooks/useHasHover'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AbilityContext } from '@/providers/AbilityProvider'
import { ChevronDown, ChevronUp, ListX, Music, Play, Trash2, User, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import { MarqueeText } from '@/components/ui/marquee-text'
import type { MusicSource } from '@music-together/shared'

const EMPTY_QUEUE: Track[] = []

const SOURCE_STYLE: Record<MusicSource, { label: string; className: string }> = {
  netease: { label: '网易', className: 'text-white bg-red-500 ring-red-600/50' },
  tencent: { label: 'QQ', className: 'text-white bg-green-500 ring-green-600/50' },
  kugou: { label: '酷狗', className: 'text-white bg-blue-500 ring-blue-600/50' },
}

interface QueueDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRemoveFromQueue: (trackId: string) => void
  onReorderQueue: (trackIds: string[]) => void
  onClearQueue: () => void
}

export function QueueDrawer({ open, onOpenChange, onRemoveFromQueue, onReorderQueue, onClearQueue }: QueueDrawerProps) {
  const queue = useRoomStore((s) => s.room?.queue ?? EMPTY_QUEUE)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const { socket } = useSocketContext()
  const isMobile = useIsMobile() // layout: Drawer direction, height
  const hasHover = useHasHover() // interaction: hover vs touch
  const isTouch = !hasHover
  const ability = useContext(AbilityContext)
  const canRemove = ability.can('remove', 'Queue')
  const canReorder = ability.can('reorder', 'Queue')
  const canPlay = ability.can('play', 'Player')
  const canVote = ability.can('vote', 'Player')
  const [confirmClear, setConfirmClear] = useState(false)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Mobile: track which item has its action toolbar visible
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null)

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

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction={isMobile ? 'bottom' : 'right'}>
      <DrawerContent className={cn('flex flex-col p-0', isMobile && 'h-[70vh]')}>
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

        <ScrollArea className="min-h-0 flex-1">
          {queue.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">播放列表为空</div>
          ) : (
            <div className="p-2">
              <AnimatePresence initial={false}>
                {queue.map((track, i) => (
                  <motion.div
                    key={track.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      'group relative flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-accent/50',
                      currentTrack?.id === track.id && 'bg-primary/10',
                    )}
                    onClick={() => {
                      if (isTouch) {
                        setActiveTrackId((prev) => (prev === track.id ? null : track.id))
                      }
                    }}
                  >
                    {/* Index */}
                    <span className="w-5 shrink-0 text-center text-xs tabular-nums text-muted-foreground">{i + 1}</span>

                    {/* Cover + source badge */}
                    <div className="relative shrink-0">
                      {track.cover ? (
                        <img
                          src={track.cover}
                          alt={track.title}
                          className="h-9 w-9 rounded object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            e.currentTarget.nextElementSibling?.classList.remove('hidden')
                          }}
                        />
                      ) : null}
                      <div
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded bg-muted',
                          track.cover && 'hidden',
                        )}
                      >
                        <Music className="h-4 w-4 text-muted-foreground" />
                      </div>
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
                      <MarqueeText
                        className={cn('text-sm', currentTrack?.id === track.id && 'font-medium text-primary')}
                      >
                        {track.title}
                      </MarqueeText>
                      <MarqueeText className="text-xs text-muted-foreground">{track.artist.join(' / ')}</MarqueeText>
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

                    {/* Actions — visible on hover (desktop) or tap (mobile) */}
                    <div
                      className={cn(
                        'absolute right-1 top-1/2 z-20 flex -translate-y-1/2 items-center gap-0.5',
                        'rounded-md border border-border/50 bg-popover px-1 py-0.5 shadow-md backdrop-blur-md',
                        'opacity-0 pointer-events-none transition-opacity',
                        'group-hover:opacity-100 group-hover:pointer-events-auto',
                        'group-focus-within:opacity-100 group-focus-within:pointer-events-auto',
                        isTouch && activeTrackId === track.id && 'opacity-100 pointer-events-auto',
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Play button — hidden for currently playing track */}
                      {currentTrack?.id !== track.id && (canPlay || canVote) && (
                        <Tooltip delayDuration={400}>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 min-h-9 min-w-9 sm:min-h-0 sm:min-w-0"
                              onClick={() => handlePlayTrack(track)}
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
                                disabled={i === 0}
                                onClick={() => handleMoveUp(i)}
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
                                disabled={i === queue.length - 1}
                                onClick={() => handleMoveDown(i)}
                                aria-label={`下移 ${track.title}`}
                              >
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">下移</TooltipContent>
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
                              onClick={() => handleRemoveTrack(track)}
                              aria-label={canRemove ? `移除 ${track.title}` : `投票移除 ${track.title}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">{canRemove ? '移除' : '投票移除'}</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  )
}
