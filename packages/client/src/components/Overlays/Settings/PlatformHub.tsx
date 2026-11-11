import { DialogPageTransition } from '@/components/DialogNav'
import { PlaylistPage } from '@/components/Pages/PlaylistPage'
import type { AccountSession } from '@/hooks/useAccountSession'
import { useAccountDiscover } from '@/hooks/useAccountDiscover'
import type { DialogPages } from '@/hooks/useDialogPages'
import { usePlaylist } from '@/hooks/usePlaylist'
import { openArtistPage } from '@/stores/artistPageStore'
import type { Artist, Playlist } from '@music-together/shared'
import { useCallback, useEffect } from 'react'
import { AccountHome } from './AccountHome'

/**
 * A list of tracks opened from the home page, one level in: a playlist or album (read with the account for personal
 * lists), or today's songs. The dialog's title bar shows its `title` and the way back.
 */
export type AccountPage = { title: string } & ({ kind: 'collection'; playlist: Playlist } | { kind: 'daily' })

/**
 * Body of the account dialog: the home page (`AccountHome`) and the list opened from it, shown in place. The pages
 * (which one is open, the way back) belong to the dialog, whose title bar shows them; this keeps the data both pages
 * share. An artist opens the app's artist page on top. Which platform and who is signed in comes from the dialog's
 * session (its title bar owns the platform switcher and the account).
 */
export function PlatformHub({ session, pages }: { session: AccountSession; pages: DialogPages<AccountPage> }) {
  const { platform, loggedIn, verifying } = session
  const playlist = usePlaylist()
  const discover = useAccountDiscover(platform, loggedIn, verifying)
  const { open: openPage, reset: backToHome } = pages

  // Switching platform leaves whatever was open: it belongs to the previous one.
  useEffect(() => {
    backToHome()
  }, [platform, backToHome])

  const openCollection = useCallback(
    (pl: Playlist, type: 'playlist' | 'album', personal: boolean) => {
      openPage({ kind: 'collection', title: pl.name, playlist: pl })
      // Personal: read with the user's login (private tracks, personalised radar content). Otherwise anonymously.
      playlist.fetchPlaylistTracks(platform, pl.id, pl.trackCount, type, personal)
    },
    [platform, playlist, openPage],
  )

  const page = pages.current
  const { daily } = discover
  const isDaily = page?.kind === 'daily'

  return (
    <DialogPageTransition pageKey={!page ? 'home' : page.kind === 'daily' ? 'daily' : `collection:${page.playlist.id}`}>
      {page ? (
        <PlaylistPage
          playlist={
            page.kind === 'daily'
              ? { id: 'daily', name: page.title, cover: '', trackCount: daily.items.length, source: platform }
              : page.playlist
          }
          tracks={isDaily ? daily.items : playlist.playlistTracks}
          loading={isDaily ? daily.loading : playlist.tracksLoading}
          loadingMore={isDaily ? false : playlist.loadingMore}
          hasMore={isDaily ? false : playlist.hasMoreTracks}
          total={isDaily ? daily.items.length : playlist.playlistTotal}
          onAddTrack={playlist.addTrackToQueue}
          onInsertAfterCurrent={playlist.insertTrackAfterCurrent}
          onAddAll={playlist.addBatchToQueue}
          onLoadMore={isDaily ? () => {} : playlist.loadMoreTracks}
        />
      ) : (
        <AccountHome
          session={session}
          discover={discover}
          playlists={playlist}
          onOpenPlaylist={openCollection}
          onOpenDaily={() => openPage({ kind: 'daily', title: '每日推荐' })}
          onOpenArtist={(artist: Artist) => openArtistPage({ source: platform, id: artist.id, name: artist.name })}
        />
      )}
    </DialogPageTransition>
  )
}
