import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Track } from '@music-together/shared'
import { Check, Music2, Plus } from 'lucide-react'
import { memo } from 'react'

export interface TrackListItemProps {
  track: Track
  index: number
  isAdded: boolean
  onAdd: (track: Track) => void
  onArtistClick?: (artist: string) => void
  style?: React.CSSProperties
  className?: string
}

export const TrackListItem = memo(function TrackListItem({
  track,
  index,
  isAdded,
  onAdd,
  onArtistClick,
  style,
  className,
}: TrackListItemProps) {
  return (
    <div
      style={style}
      className={cn('group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50', className)}
    >
      {/* Index */}
      <span className="w-6 shrink-0 text-center text-xs tabular-nums text-muted-foreground">{index + 1}</span>

      {/* Cover thumbnail */}
      {track.cover ? (
        <img src={track.cover} alt="" className="h-10 w-10 shrink-0 rounded object-cover" loading="lazy" />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted">
          <Music2 className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      {/* Track info */}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
          <span className="truncate">{track.title}</span>
          {track.vip && (
            <span className="inline-flex shrink-0 items-center rounded px-1 py-0.5 text-[10px] font-bold leading-none text-amber-500 ring-1 ring-amber-500/30 bg-amber-500/10">
              VIP
            </span>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {onArtistClick
            ? track.artist.map((a, ai) => (
                <span key={ai}>
                  {ai > 0 && ' / '}
                  <button
                    type="button"
                    className="hover:text-foreground hover:underline"
                    onClick={(e) => {
                      e.stopPropagation()
                      onArtistClick(a)
                    }}
                  >
                    {a}
                  </button>
                </span>
              ))
            : track.artist.join(' / ')}
          {track.album ? ` · ${track.album}` : ''}
        </p>
      </div>

      {/* Duration */}
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatDuration(track.duration)}</span>

      {/* Add button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isAdded ? 'ghost' : 'outline'}
            size="icon"
            className={cn('h-8 w-8 shrink-0', isAdded && 'text-emerald-500 hover:text-emerald-500')}
            disabled={isAdded}
            onClick={() => onAdd(track)}
            aria-label={isAdded ? '已添加' : `添加 ${track.title} 到播放列表`}
          >
            {isAdded ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{isAdded ? '已添加' : '添加到播放列表'}</TooltipContent>
      </Tooltip>
    </div>
  )
})
