import type { AccountSession } from '@/hooks/useAccountSession'
import { useAccountDiscover } from '@/hooks/useAccountDiscover'
import { usePlaylist } from '@/hooks/usePlaylist'
import { CLIPPING_PANE } from '@/lib/utils'
import { openArtistPage } from '@/stores/artistPageStore'
import type { Artist, Playlist } from '@music-together/shared'
import { useCallback, useState } from 'react'
import { AccountHome } from './AccountHome'
import { PlaylistDetail } from './PlaylistDetail'

/** A list of tracks opened from the page: a playlist or album (read with the account for personal lists), or today's songs. */
type Detail = { kind: 'collection'; playlist: Playlist } | { kind: 'daily' }

/**
 * Body of the account dialog: the home page (`AccountHome`) and the list opened from it — a playlist, an album or
 * today's songs — shown in place with a way back. An artist opens the app's artist page on top. Which platform and who
 * is signed in comes from the dialog's session (its header owns the platform switcher and the account).
 */
export function PlatformHub({ session }: { session: AccountSession }) {
  const { platform, loggedIn, verifying } = session
  const playlist = usePlaylist()
  const discover = useAccountDiscover(platform, loggedIn, verifying)

  const [detail, setDetail] = useState<Detail | null>(null)

  // Switching platform leaves whatever was open: it belongs to the previous one.
  const [shownPlatform, setShownPlatform] = useState(platform)
  if (shownPlatform !== platform) {
    setShownPlatform(platform)
    setDetail(null)
  }

  const openCollection = useCallback(
    (pl: Playlist, type: 'playlist' | 'album', personal: boolean) => {
      setDetail({ kind: 'collection', playlist: pl })
      // Personal: read with the user's login (private tracks, personalised radar content). Otherwise anonymously.
      playlist.fetchPlaylistTracks(platform, pl.id, pl.trackCount, type, personal)
    },
    [platform, playlist],
  )

  // Detail view — flex-1 min-h-0 so the list gets proper height for virtual scrolling
  if (detail) {
    const { daily } = discover
    const isDaily = detail.kind === 'daily'
    return (
      <div className={CLIPPING_PANE}>
        <PlaylistDetail
          playlist={
            isDaily
              ? { id: 'daily', name: '每日推荐', cover: '', trackCount: daily.items.length, source: platform }
              : detail.playlist
          }
          tracks={isDaily ? daily.items : playlist.playlistTracks}
          loading={isDaily ? daily.loading : playlist.tracksLoading}
          loadingMore={isDaily ? false : playlist.loadingMore}
          hasMore={isDaily ? false : playlist.hasMoreTracks}
          total={isDaily ? daily.items.length : playlist.playlistTotal}
          onBack={() => setDetail(null)}
          onAddTrack={playlist.addTrackToQueue}
          onInsertAfterCurrent={playlist.insertTrackAfterCurrent}
          onAddAll={playlist.addBatchToQueue}
          onLoadMore={isDaily ? () => {} : playlist.loadMoreTracks}
        />
      </div>
    )
  }

  return (
    <AccountHome
      session={session}
      discover={discover}
      playlists={playlist}
      onOpenPlaylist={openCollection}
      onOpenDaily={() => setDetail({ kind: 'daily' })}
      onOpenArtist={(artist: Artist) => openArtistPage({ source: platform, id: artist.id, name: artist.name })}
    />
  )
}
