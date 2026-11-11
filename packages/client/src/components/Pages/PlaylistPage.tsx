import { CLIPPING_PANE, cn } from '@/lib/utils'
import type { Playlist, Track } from '@music-together/shared'
import { TrackCollection } from './TrackCollection'

interface PlaylistPageProps {
  playlist: Playlist | null
  tracks: Track[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  total: number
  onAddTrack: (track: Track) => void
  onInsertAfterCurrent?: (track: Track) => void
  onAddAll: (tracks: Track[], playlistName?: string) => void
  onLoadMore: () => void
}

/**
 * The songs of a playlist or album, with "add all". A page of its own: whatever dialog holds it supplies the title and
 * the way back (see `DialogNavBar`), so it can be shown from anywhere.
 */
export function PlaylistPage({
  playlist,
  tracks,
  loading,
  loadingMore,
  hasMore,
  total,
  onAddTrack,
  onInsertAfterCurrent,
  onAddAll,
  onLoadMore,
}: PlaylistPageProps) {
  return (
    // A list reaches nearly to the edges of the dialog (its rows carry their own side padding), instead of sitting
    // inside the dialog body's padding as well: the pane takes back most of that padding.
    <div className={cn(CLIPPING_PANE, '-mx-3 -mb-3 sm:-mx-5 sm:-mb-5')}>
      <TrackCollection
        tracks={tracks}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        total={total}
        subtitle={playlist?.creator}
        collectionName={playlist?.name}
        infoClassName="px-3"
        onAddTrack={onAddTrack}
        onInsertAfterCurrent={onInsertAfterCurrent}
        onAddAll={onAddAll}
        onLoadMore={onLoadMore}
      />
    </div>
  )
}
