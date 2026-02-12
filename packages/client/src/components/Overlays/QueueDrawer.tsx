import { Trash2, Music, ChevronUp, ChevronDown } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'
import { usePlayerStore } from '@/stores/playerStore'
import { cn } from '@/lib/utils'

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
      <SheetContent side="right" showCloseButton={false} className="flex w-[400px] flex-col p-0">
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
                    'group flex items-center gap-3 rounded-lg px-3 py-2',
                    currentTrack?.id === track.id && 'bg-primary/10',
                  )}
                >
                  <span className="w-6 text-center text-xs tabular-nums text-muted-foreground">
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

                  {/* Reorder + Delete buttons */}
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={i === 0}
                          onClick={() => handleMoveUp(i)}
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>上移</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={i === queue.length - 1}
                          onClick={() => handleMoveDown(i)}
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>下移</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => onRemoveFromQueue(track.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>移除</TooltipContent>
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
