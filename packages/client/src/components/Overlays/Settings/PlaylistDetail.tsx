import { Button } from '@/components/ui/button'
import { CLIPPING_PANE } from '@/lib/utils'
import type { Playlist, Track } from '@music-together/shared'
import { ArrowLeft } from 'lucide-react'
import { TrackCollection } from './TrackCollection'

interface PlaylistDetailProps {
  playlist: Playlist | null
  tracks: Track[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  total: number
  onBack: () => void
  onAddTrack: (track: Track) => void
  onInsertAfterCurrent?: (track: Track) => void
  onAddAll: (tracks: Track[], playlistName?: string) => void
  onLoadMore: () => void
}

export function PlaylistDetail({
  playlist,
  tracks,
  loading,
  loadingMore,
  hasMore,
  total,
  onBack,
  onAddTrack,
  onInsertAfterCurrent,
  onAddAll,
  onLoadMore,
}: PlaylistDetailProps) {
  return (
    <div className={CLIPPING_PANE}>
      {/* Back + Title — pr-8 reserves space for dialog close button */}
      <div className="flex shrink-0 items-center gap-2 pr-8">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 shrink-0" aria-label="返回">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h4 className="min-w-0 flex-1 truncate text-sm font-semibold">{playlist?.name ?? '歌单详情'}</h4>
      </div>

      <TrackCollection
        tracks={tracks}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        total={total}
        subtitle={playlist?.creator}
        collectionName={playlist?.name}
        onAddTrack={onAddTrack}
        onInsertAfterCurrent={onInsertAfterCurrent}
        onAddAll={onAddAll}
        onLoadMore={onLoadMore}
      />
    </div>
  )
}
