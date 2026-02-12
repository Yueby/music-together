import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { usePlayerStore } from '@/stores/playerStore'
import { ChevronDown, ChevronUp, Music, Trash2 } from 'lucide-react'

interface QueueDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRemoveFromQueue: (trackId: string) => void
  onReorderQueue: (trackIds: string[]) => void
}

export function QueueDrawer({ open, onOpenChange, onRemoveFromQueue, onReorderQueue }: QueueDrawerProps) {
  const queue = usePlayerStore((s) => s.queue)
  const currentTrack = usePlayerStore((s) => s.currentTrack)

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" showCloseButton={false} className="flex w-[380px] flex-col p-0">
        <SheetHeader className="shrink-0 border-b px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Music className="h-4 w-4" />
            播放列表 ({queue.length})
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          {queue.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              播放列表为空
            </div>
          ) : (
            <div className="p-2">
              {queue.map((track, i) => (
                <div
                  key={track.id}
                  className={cn(
                    'group relative flex items-center gap-2 rounded-lg px-2 py-2',
                    currentTrack?.id === track.id && 'bg-primary/10',
                  )}
                >
                  {/* Index */}
                  <span className="w-5 shrink-0 text-center text-xs tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>

                  {/* Cover */}
                  {track.cover ? (
                    <img
                      src={track.cover}
                      alt={track.title}
                      className="h-9 w-9 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-muted">
                      <Music className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}

                  {/* Track info */}
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'truncate text-sm',
                        currentTrack?.id === track.id && 'font-medium text-primary',
                      )}
                    >
                      {track.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {track.artist.join(' / ')}
                    </p>
                  </div>

                  {/* Actions — overlay on hover, positioned over right side */}
                  <div
                    className={cn(
                      'absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5',
                      'rounded-md bg-background/90 px-1 py-0.5 shadow-sm backdrop-blur-sm',
                      'opacity-0 transition-opacity group-hover:opacity-100',
                    )}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={i === 0}
                          onClick={() => handleMoveUp(i)}
                        >
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">上移</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={i === queue.length - 1}
                          onClick={() => handleMoveDown(i)}
                        >
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">下移</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => onRemoveFromQueue(track.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">移除</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
