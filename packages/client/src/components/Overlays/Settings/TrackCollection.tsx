import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { VirtualTrackList } from '@/components/VirtualTrackList'
import { trackKey } from '@/lib/utils'
import { useRoomStore } from '@/stores/roomStore'
import type { Track } from '@music-together/shared'
import { LIMITS } from '@music-together/shared'
import { ListPlus, Music } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'

const EMPTY_QUEUE: Track[] = []

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
  onArtistClick?: (artist: string) => void
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
  onArtistClick,
}: TrackCollectionProps) {
  const queue = useRoomStore((s) => s.room?.queue ?? EMPTY_QUEUE)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const queueKeys = useMemo(() => new Set(queue.map(trackKey)), [queue])

  const isTrackAdded = useCallback(
    (track: Track) => {
      const key = trackKey(track)
      return addedIds.has(key) || queueKeys.has(key)
    },
    [addedIds, queueKeys],
  )

  const handleAddTrack = useCallback(
    (track: Track) => {
      const key = trackKey(track)
      if (queueKeys.has(key) || addedIds.has(key)) {
        toast.info(`「${track.title}」已在队列中`)
        return
      }
      onAddTrack(track)
      setAddedIds((prev) => new Set(prev).add(key))
    },
    [onAddTrack, queueKeys, addedIds],
  )

  const handleInsertAfterCurrent = useCallback(
    (track: Track) => {
      const key = trackKey(track)
      if (queueKeys.has(key) || addedIds.has(key)) {
        toast.info(`「${track.title}」已在队列中`)
        return
      }
      onInsertAfterCurrent?.(track)
      setAddedIds((prev) => new Set(prev).add(key))
    },
    [onInsertAfterCurrent, queueKeys, addedIds],
  )

  // Dynamic "add all" logic — filter duplicates
  const availableSlots = LIMITS.QUEUE_MAX_SIZE - queue.length
  const uniqueTracks = useMemo(() => tracks.filter((t) => !isTrackAdded(t)), [tracks, isTrackAdded])
  const addCount = Math.min(availableSlots, uniqueTracks.length)
  const isQueueFull = availableSlots <= 0

  const handleAddAll = useCallback(() => {
    if (addCount <= 0) return
    const toAdd = uniqueTracks.slice(0, addCount)
    onAddAll(toAdd, collectionName)
    setAddedIds((prev) => {
      const next = new Set(prev)
      for (const t of toAdd) next.add(trackKey(t))
      return next
    })
    if (addCount < uniqueTracks.length) {
      toast.success(`已添加 ${addCount} 首到队列（队列已满，还有 ${uniqueTracks.length - addCount} 首未添加）`)
    } else {
      toast.success(`已添加全部 ${addCount} 首到队列`)
    }
  }, [addCount, uniqueTracks, onAddAll, collectionName])

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
        onArtistClick={onArtistClick}
        emptyIcon={<Music className="h-8 w-8" />}
        emptyMessage={emptyMessage}
        className="rounded-none border-0"
      />
    </div>
  )
}
