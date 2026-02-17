import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { Track } from '@music-together/shared'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Loader2, Music2 } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { TrackListItem } from './TrackListItem'

/** Start loading more items when the last visible row is within this many rows of the end */
const LOAD_MORE_THRESHOLD = 5

export interface VirtualTrackListProps {
  tracks: Track[]
  loading: boolean
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  isTrackAdded: (track: Track) => boolean
  onAddTrack: (track: Track) => void
  onArtistClick?: (artist: string) => void
  emptyIcon?: React.ReactNode
  emptyMessage?: string
  rowHeight?: number
  overscan?: number
  className?: string
}

export interface VirtualTrackListRef {
  scrollToTop: () => void
}

function TrackSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Skeleton className="h-4 w-6" />
      <Skeleton className="h-10 w-10 rounded" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-8 w-8 rounded-md" />
    </div>
  )
}

export const VirtualTrackList = forwardRef<VirtualTrackListRef, VirtualTrackListProps>(
  function VirtualTrackList(
    {
      tracks,
      loading,
      hasMore,
      loadingMore,
      onLoadMore,
      isTrackAdded,
      onAddTrack,
      onArtistClick,
      emptyIcon,
      emptyMessage = '暂无内容',
      rowHeight = 52,
      overscan = 5,
      className,
    },
    ref,
  ) {
    const scrollRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(ref, () => ({
      scrollToTop: () => scrollRef.current?.scrollTo({ top: 0 }),
    }))

    const rowCount = tracks.length + (hasMore ? 1 : 0)

    const virtualizer = useVirtualizer({
      count: rowCount,
      getScrollElement: () => scrollRef.current,
      estimateSize: () => rowHeight,
      overscan,
    })

    // Infinite scroll: trigger onLoadMore when approaching the bottom
    const virtualItems = virtualizer.getVirtualItems()
    const lastItem = virtualItems.at(-1)

    useEffect(() => {
      if (!lastItem) return
      if (lastItem.index >= tracks.length - LOAD_MORE_THRESHOLD && hasMore && !loadingMore) {
        onLoadMore()
      }
    }, [lastItem?.index, tracks.length, hasMore, loadingMore, onLoadMore])

    // Loading skeleton
    if (loading) {
      return (
        <div className={cn('min-h-0 flex-1 overflow-y-auto rounded-md border', className)}>
          <div className="divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <TrackSkeleton key={i} />
            ))}
          </div>
        </div>
      )
    }

    // Empty state
    if (tracks.length === 0) {
      return (
        <div className={cn('min-h-0 flex-1 overflow-y-auto rounded-md border', className)}>
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
            {emptyIcon ?? <Music2 className="h-8 w-8" />}
            <span className="text-sm">{emptyMessage}</span>
          </div>
        </div>
      )
    }

    return (
      <div
        ref={scrollRef}
        className={cn('min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto rounded-md border', className)}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualRow) => {
            const isLoaderRow = virtualRow.index >= tracks.length

            if (isLoaderRow) {
              return (
                <div
                  key="loader"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="flex items-center justify-center"
                >
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )
            }

            const track = tracks[virtualRow.index]

            return (
              <TrackListItem
                key={track.id}
                track={track}
                index={virtualRow.index}
                isAdded={isTrackAdded(track)}
                onAdd={onAddTrack}
                onArtistClick={onArtistClick}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              />
            )
          })}
        </div>
      </div>
    )
  },
)
