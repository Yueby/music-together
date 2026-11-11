import { DialogNavBar, DialogPageTransition } from '@/components/DialogNav'
import { ArtistPage } from '@/components/Pages/ArtistPage'
import { PlaylistPage } from '@/components/Pages/PlaylistPage'
import {
  DIALOG_BODY_CLASS,
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
} from '@/components/ui/responsive-dialog'
import { useArtist } from '@/hooks/useArtist'
import { useDialogPages } from '@/hooks/useDialogPages'
import { usePlaylist } from '@/hooks/usePlaylist'
import { cn } from '@/lib/utils'
import { useArtistPageStore, type ArtistTarget } from '@/stores/artistPageStore'
import type { Playlist } from '@music-together/shared'
import { useCallback, useEffect } from 'react'

/**
 * The artist page, one for the whole app: whatever shows an artist name (a song, the queue, the player, a search result)
 * opens it through `openArtistPage`. It stacks over whatever dialog it was opened from, so closing it returns there.
 */
export function ArtistDialog() {
  const target = useArtistPageStore((state) => state.target)
  const close = useArtistPageStore((state) => state.close)
  return (
    <ResponsiveDialog open={target !== null} onOpenChange={(open) => !open && close()}>
      <ResponsiveDialogContent className="flex h-[70vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {/* Only while open: the page's data and socket handlers exist for as long as someone looks at it. A different
            artist (say, a collaborator clicked inside this page) is a new page: it starts over at its songs. */}
        {target ? <ArtistDialogBody key={`${target.source}:${target.id ?? target.name}`} target={target} /> : null}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}

/** An album opened from the artist's page: one level in, named in the title bar. */
interface AlbumPage {
  title: string
  album: Playlist
}

function ArtistDialogBody({ target }: { target: ArtistTarget }) {
  const artistState = useArtist()
  const playlist = usePlaylist()
  const pages = useDialogPages<AlbumPage>()
  const { load, loadByName } = artistState
  const { reset: backToArtist } = pages

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
    backToArtist()
  }, [target, backToArtist])

  const openAlbum = (selected: Playlist) => {
    pages.open({ title: selected.name, album: selected })
    playlist.fetchPlaylistTracks(target.source, selected.id, selected.trackCount, 'album')
  }

  const page = pages.current
  return (
    <>
      {/* The artist's own page has no way back (the dialog's close button returns to where it was opened from) */}
      <DialogNavBar
        title={page?.title ?? artistState.artist?.name ?? target.name}
        description="歌手的热门歌曲和专辑"
        onBack={page ? pages.back : undefined}
      />
      <ResponsiveDialogBody className={cn(DIALOG_BODY_CLASS, 'flex min-h-0 flex-1 flex-col')}>
        <DialogPageTransition pageKey={page ? `album:${page.album.id}` : 'artist'}>
          {page ? (
            <PlaylistPage
              playlist={page.album}
              tracks={playlist.playlistTracks}
              loading={playlist.tracksLoading}
              loadingMore={playlist.loadingMore}
              hasMore={playlist.hasMoreTracks}
              total={playlist.playlistTotal}
              onAddTrack={playlist.addTrackToQueue}
              onInsertAfterCurrent={playlist.insertTrackAfterCurrent}
              onAddAll={playlist.addBatchToQueue}
              onLoadMore={playlist.loadMoreTracks}
            />
          ) : (
            <ArtistPage
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
              onRetry={open}
              onAddTrack={playlist.addTrackToQueue}
              onInsertAfterCurrent={playlist.insertTrackAfterCurrent}
              onAddAll={playlist.addBatchToQueue}
              onLoadMoreSongs={() => void artistState.loadMoreSongs()}
              onLoadMoreAlbums={() => void artistState.loadMoreAlbums()}
              onSelectAlbum={openAlbum}
            />
          )}
        </DialogPageTransition>
      </ResponsiveDialogBody>
    </>
  )
}
