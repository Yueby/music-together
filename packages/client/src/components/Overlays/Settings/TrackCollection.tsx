import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { VirtualTrackList } from '@/components/VirtualTrackList'
import { useQueueMembership } from '@/hooks/useQueueMembership'
import { batchAddMessage, planBatchAdd } from '@/lib/batchAdd'
import type { Track } from '@music-together/shared'
import { ListPlus, Music } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'

export interface TrackCollectionProps {
  tracks: Track[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  total: number
  /** Shown after the count, e.g. the playlist creator. */
  subtitle?: string
  /** Name recorded with a batch add ("Added N songs from …"). */
  collectionName?: string
  emptyMessage?: string
  onAddTrack: (track: Track) => void
  onInsertAfterCurrent?: (track: Track) => void
  onAddAll: (tracks: Track[], collectionName?: string) => void
  onLoadMore: () => void
  onUnsupportedArtistClick?: (artist: string) => void
}

/**
 * A loaded, pageable list of tracks with per-row add buttons and an "add all" action that skips what is already
 * queued and respects the queue limit. Shared by playlist, album and artist views.
 */
export function TrackCollection({
  tracks,
  loading,
  loadingMore,
  hasMore,
  total,
  subtitle,
  collectionName,
  emptyMessage = '歌单为空',
  onAddTrack,
  onInsertAfterCurrent,
  onAddAll,
  onLoadMore,
  onUnsupportedArtistClick,
}: TrackCollectionProps) {
  const { queue, isAdded: isTrackAdded, markPending, addOnce } = useQueueMembership()

  const handleAddTrack = useCallback((track: Track) => addOnce(track, onAddTrack), [addOnce, onAddTrack])

  const handleInsertAfterCurrent = useCallback(
    (track: Track) => addOnce(track, (added) => onInsertAfterCurrent?.(added)),
    [addOnce, onInsertAfterCurrent],
  )

  // "Add all": skip what is queued already and respect the queue limit
  const plan = useMemo(() => planBatchAdd(tracks, isTrackAdded, queue.length), [tracks, isTrackAdded, queue.length])
  const { unique: uniqueTracks, count: addCount, queueFull: isQueueFull } = plan

  const handleAddAll = useCallback(() => {
    if (plan.count <= 0) return
    onAddAll(plan.toAdd, collectionName)
    markPending(plan.toAdd)
    toast.success(batchAddMessage(plan))
  }, [plan, onAddAll, markPending, collectionName])

  // Button label
  let addAllLabel: string
  if (loading) {
    addAllLabel = '加载中…'
  } else if (tracks.length === 0) {
    addAllLabel = '添加全部'
  } else if (isQueueFull) {
    addAllLabel = '队列已满'
  } else if (uniqueTracks.length === 0) {
    addAllLabel = '全部已添加'
  } else if (addCount === uniqueTracks.length) {
    addAllLabel = `添加全部 ${addCount} 首`
  } else {
    addAllLabel = `添加 ${addCount} 首到队列`
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {/* Info + Action */}
      <div className="flex shrink-0 items-center justify-between gap-3 py-1">
        <p className="text-muted-foreground min-w-0 truncate text-xs">
          {loading
            ? '加载中…'
            : `${total} 首${tracks.length < total ? `（已加载 ${tracks.length}）` : ''}${subtitle ? ` · ${subtitle}` : ''}`}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddAll}
          disabled={loading || isQueueFull || uniqueTracks.length === 0}
          className="shrink-0 gap-1"
        >
          <ListPlus className="h-3.5 w-3.5" />
          {addAllLabel}
        </Button>
      </div>

      <Separator className="shrink-0" />

      {/* Track list with shared virtual scrolling component */}
      <VirtualTrackList
        tracks={tracks}
        loading={loading}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={onLoadMore}
        isTrackAdded={isTrackAdded}
        onAddTrack={handleAddTrack}
        onInsertAfterCurrent={onInsertAfterCurrent ? handleInsertAfterCurrent : undefined}
        onUnsupportedArtistClick={onUnsupportedArtistClick}
        emptyIcon={<Music className="h-8 w-8" />}
        emptyMessage={emptyMessage}
        className="rounded-none border-0"
      />
    </div>
  )
}
