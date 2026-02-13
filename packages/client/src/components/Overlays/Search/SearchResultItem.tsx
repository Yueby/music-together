import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { Track } from '@music-together/shared'
import { Check, Music2, Plus } from 'lucide-react'
import { motion } from 'motion/react'

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface SearchResultItemProps {
  track: Track
  index: number
  isAdded: boolean
  onAdd: (track: Track) => void
  onSearchArtist: (artist: string) => void
}

export function SearchResultItem({ track, index, isAdded, onAdd, onSearchArtist }: SearchResultItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.3) }}
      className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50"
    >
      {/* Index */}
      <span className="w-6 shrink-0 text-center text-xs tabular-nums text-muted-foreground">
        {index + 1}
      </span>

      {/* Cover thumbnail */}
      {track.cover ? (
        <img
          src={track.cover}
          alt=""
          className="h-10 w-10 shrink-0 rounded object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted">
          <Music2 className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      {/* Track info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{track.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {track.artist.map((a, ai) => (
            <span key={ai}>
              {ai > 0 && ' / '}
              <button
                type="button"
                className="hover:text-foreground hover:underline"
                onClick={(e) => {
                  e.stopPropagation()
                  onSearchArtist(a)
                }}
              >
                {a}
              </button>
            </span>
          ))}
          {track.album ? ` · ${track.album}` : ''}
        </p>
      </div>

      {/* Duration */}
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {formatDuration(track.duration)}
      </span>

      {/* Add button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isAdded ? 'ghost' : 'outline'}
            size="icon"
            className={cn(
              'h-8 w-8 shrink-0',
              isAdded && 'text-emerald-500 hover:text-emerald-500',
            )}
            disabled={isAdded}
            onClick={() => onAdd(track)}
            aria-label={isAdded ? '已添加' : `添加 ${track.title} 到播放列表`}
          >
            {isAdded ? (
              <Check className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{isAdded ? '已添加' : '添加到播放列表'}</TooltipContent>
      </Tooltip>
    </motion.div>
  )
}
