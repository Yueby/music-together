import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ArtistNames } from '@/components/ArtistNames'
import { ArtworkImage } from '@/components/ArtworkImage'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Track } from '@music-together/shared'
import { ArrowUpToLine, Check, Music2, Plus } from 'lucide-react'
import { memo } from 'react'

export interface TrackListItemProps {
  track: Track
  index: number
  isAdded: boolean
  onAdd: (track: Track) => void
  onInsertAfterCurrent?: (track: Track) => void
  /** What a click on an artist name does on a platform without artist pages (names open the artist page elsewhere). */
  onUnsupportedArtistClick?: (artist: string) => void
  style?: React.CSSProperties
  className?: string
}

export const TrackListItem = memo(function TrackListItem({
  track,
  index,
  isAdded,
  onAdd,
  onInsertAfterCurrent,
  onUnsupportedArtistClick,
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
      <ArtworkImage
        cover={track.thumbnailCover ?? track.cover}
        lazy
        fallback={<Music2 className="h-4 w-4 text-muted-foreground" />}
        className="h-10 w-10 rounded"
      />

      {/* Track info */}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
          <span className="truncate">{track.title}</span>
          {track.vip && (
            <Badge
              variant="outline"
              className="rounded border-amber-500/30 bg-amber-500/10 px-1 py-0.5 text-[10px] leading-none font-bold text-amber-500"
            >
              VIP
            </Badge>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          <ArtistNames track={track} onUnsupportedClick={onUnsupportedArtistClick} />
          {track.album ? ` · ${track.album}` : ''}
        </p>
      </div>

      {/* Duration */}
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatDuration(track.duration)}</span>

      {/* Add / Top buttons */}
      <div className="flex shrink-0 items-center gap-1">
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

        {onInsertAfterCurrent && !isAdded && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => onInsertAfterCurrent(track)}
                aria-label={`置顶 ${track.title}`}
              >
                <ArrowUpToLine className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>置顶到当前播放下方</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )
})
