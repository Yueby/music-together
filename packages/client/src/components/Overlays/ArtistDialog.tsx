import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
import { useArtist } from '@/hooks/useArtist'
import { usePlaylist } from '@/hooks/usePlaylist'
import { useArtistPageStore, type ArtistTarget } from '@/stores/artistPageStore'
import type { Playlist } from '@music-together/shared'
import { useCallback, useEffect, useState } from 'react'
import { ArtistDetail } from './ArtistDetail'
import { PlaylistDetail } from './Settings/PlaylistDetail'

/**
 * The artist page, one for the whole app: whatever shows an artist name (a song, the queue, the player, a search result)
 * opens it through `openArtistPage`. It stacks over whatever dialog it was opened from, so closing it returns there.
 */
export function ArtistDialog() {
  const target = useArtistPageStore((state) => state.target)
  const close = useArtistPageStore((state) => state.close)
  return (
    <ResponsiveDialog open={target !== null} onOpenChange={(open) => !open && close()}>
      <ResponsiveDialogContent className="flex h-[70vh] flex-col gap-0 overflow-hidden sm:max-w-2xl">
        {/* Only while open: the page's data and socket handlers exist for as long as someone looks at it. A different
            artist (say, a collaborator clicked inside this page) is a new page: it starts over at its songs. */}
        {target ? (
          <ArtistPage key={`${target.source}:${target.id ?? target.name}`} target={target} onClose={close} />
        ) : null}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}

function ArtistPage({ target, onClose }: { target: ArtistTarget; onClose: () => void }) {
  const artistState = useArtist()
  const playlist = usePlaylist()
  const [album, setAlbum] = useState<Playlist | null>(null)
  const { load, loadByName } = artistState

  const { source, id, name } = target
  const open = useCallback(() => {
    if (id) void load(source, id, { id, name, cover: '', source })
    else void loadByName(source, name)
  }, [source, id, name, load, loadByName])

  // Depends on what the target is, not on the object: asking again for the artist already shown must not reload it.
  useEffect(() => {
    open()
  }, [open])

  // ...but it does bring the songs back from an album (say, a name tapped on a track inside one of its albums).
  useEffect(() => {
    setAlbum(null)
  }, [target])

  const openAlbum = (selected: Playlist) => {
    setAlbum(selected)
    playlist.fetchPlaylistTracks(target.source, selected.id, selected.trackCount, 'album')
  }

  return (
    <>
      <ResponsiveDialogHeader className="shrink-0 border-b px-4 py-3 pr-12 sm:px-6">
        <ResponsiveDialogTitle className="truncate text-lg font-semibold">
          {album ? album.name : (artistState.artist?.name ?? target.name)}
        </ResponsiveDialogTitle>
        <ResponsiveDialogDescription className="sr-only">歌手的热门歌曲和专辑</ResponsiveDialogDescription>
      </ResponsiveDialogHeader>
      <ResponsiveDialogBody className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {album ? (
          <PlaylistDetail
            playlist={album}
            tracks={playlist.playlistTracks}
            loading={playlist.tracksLoading}
            loadingMore={playlist.loadingMore}
            hasMore={playlist.hasMoreTracks}
            total={playlist.playlistTotal}
            onBack={() => setAlbum(null)}
            onAddTrack={playlist.addTrackToQueue}
            onInsertAfterCurrent={playlist.insertTrackAfterCurrent}
            onAddAll={playlist.addBatchToQueue}
            onLoadMore={playlist.loadMoreTracks}
          />
        ) : (
          <ArtistDetail
            artist={artistState.artist}
            loading={artistState.loading}
            error={artistState.error}
            songs={artistState.songs}
            songsTotal={artistState.songsTotal}
            songsHasMore={artistState.songsHasMore}
            songsLoadingMore={artistState.songsLoadingMore}
            albums={artistState.albums}
            albumsHasMore={artistState.albumsHasMore}
            albumsLoadingMore={artistState.albumsLoadingMore}
            onBack={onClose}
            onRetry={open}
            onAddTrack={playlist.addTrackToQueue}
            onInsertAfterCurrent={playlist.insertTrackAfterCurrent}
            onAddAll={playlist.addBatchToQueue}
            onLoadMoreSongs={() => void artistState.loadMoreSongs()}
            onLoadMoreAlbums={() => void artistState.loadMoreAlbums()}
            onSelectAlbum={openAlbum}
          />
        )}
      </ResponsiveDialogBody>
    </>
  )
}
