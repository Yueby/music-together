import type { AccountSession } from '@/hooks/useAccountSession'
import { DAILY_ID, type useAccountDiscover } from '@/hooks/useAccountDiscover'
import type { usePlaylist } from '@/hooks/usePlaylist'
import { PLATFORM_LABELS } from '@/lib/platform'
import type { Artist, Playlist } from '@music-together/shared'
import { Disc3, ListMusic, Radar, User } from 'lucide-react'
import { CoverSection, Note, Section } from './DiscoverSections'
import { LoginBanner } from './LoginBanner'
import { PlaylistSection } from './PlaylistSection'

const UNAVAILABLE = '每日推荐、推荐歌单、私人雷达、歌手推荐和新碟上架'

interface AccountHomeProps {
  session: AccountSession
  discover: ReturnType<typeof useAccountDiscover>
  playlists: Pick<ReturnType<typeof usePlaylist>, 'myPlaylists' | 'playlistsLoading' | 'fetchMyPlaylists'>
  onOpenPlaylist: (playlist: Playlist, type: 'playlist' | 'album', personal: boolean) => void
  onOpenDaily: () => void
  onOpenArtist: (artist: Artist) => void
}

/**
 * The account page itself, like a streaming app's home page: one scrolling page of blocks — your playlists, the
 * recommended playlists (today's recommendation is its first tile), radar, artists and new albums. It only shows and
 * reports what was chosen; what opens (and how it is read) is the caller's business.
 */
export function AccountHome({
  session,
  discover,
  playlists,
  onOpenPlaylist,
  onOpenDaily,
  onOpenArtist,
}: AccountHomeProps) {
  const { platform, myStatus, loggedIn, verifying, startQrLogin, setCookieOpen } = session
  const { supported, dailyTile } = discover

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-8 overflow-x-hidden overflow-y-auto pb-2 [scrollbar-gutter:stable]">
      {!loggedIn && !verifying ? (
        <LoginBanner
          platform={platform}
          withRecommendations={supported}
          onQrLogin={startQrLogin}
          onCookieLogin={() => setCookieOpen(true)}
        />
      ) : null}

      <PlaylistSection
        platform={platform}
        myStatus={myStatus}
        verifying={verifying}
        playlists={playlists.myPlaylists[platform]}
        loading={playlists.playlistsLoading[platform]}
        onFetchMyPlaylists={() => playlists.fetchMyPlaylists(platform)}
        onSelectPlaylist={(pl) => onOpenPlaylist(pl, 'playlist', true)}
      />

      {supported ? (
        <>
          <CoverSection
            platform={platform}
            title="推荐歌单"
            subtitle={loggedIn ? '根据你的口味每日更新' : '大家都在听'}
            items={dailyTile ? [dailyTile, ...discover.playlists.items] : discover.playlists.items}
            loading={discover.playlists.loading}
            error={discover.playlists.error}
            onRetry={discover.reloadHome}
            describe={(pl) => ({
              title: pl.name,
              subtitle: pl.description || `${pl.trackCount} 首`,
              cover: pl.thumbnailCover ?? pl.cover,
            })}
            fallback={<ListMusic className="text-muted-foreground size-8" />}
            onSelect={(pl) => {
              if (pl.id !== DAILY_ID) return onOpenPlaylist(pl, 'playlist', false)
              // A failed day is retried by opening it again.
              if (discover.daily.error) discover.reloadDaily()
              else onOpenDaily()
            }}
          />
          <CoverSection
            platform={platform}
            title="私人雷达"
            subtitle="为你定制的雷达歌单"
            items={discover.radar.items}
            loading={discover.radar.loading}
            error={discover.radar.error}
            onRetry={discover.reloadRadar}
            describe={(pl) => ({
              title: pl.name,
              subtitle: `${pl.trackCount} 首${pl.creator ? ` · ${pl.creator}` : ''}`,
              cover: pl.thumbnailCover ?? pl.cover,
            })}
            fallback={<Radar className="text-muted-foreground size-8" />}
            // The radar lists' songs are personal: read them with the account when there is one.
            onSelect={(pl) => onOpenPlaylist(pl, 'playlist', loggedIn)}
          />
          <CoverSection
            platform={platform}
            title="歌手推荐"
            subtitle="热门歌手"
            items={discover.artists.items}
            loading={discover.artists.loading}
            error={discover.artists.error}
            onRetry={discover.reloadHome}
            describe={(artist) => ({
              title: artist.name,
              subtitle: artist.songCount != null ? `${artist.songCount} 首歌曲` : undefined,
              cover: artist.thumbnailCover ?? artist.cover,
            })}
            fallback={<User className="text-muted-foreground size-8" />}
            round
            onSelect={onOpenArtist}
          />
          <CoverSection
            platform={platform}
            title="新碟上架"
            subtitle="最新发行的专辑"
            items={discover.albums.items}
            loading={discover.albums.loading}
            error={discover.albums.error}
            onRetry={discover.reloadHome}
            describe={(album) => ({
              title: album.name,
              subtitle: album.creator || undefined,
              cover: album.thumbnailCover ?? album.cover,
            })}
            fallback={<Disc3 className="text-muted-foreground size-8" />}
            onSelect={(album) => onOpenPlaylist(album, 'album', false)}
          />
        </>
      ) : (
        <Section title="发现">
          <Note>{`${PLATFORM_LABELS[platform]}暂不提供${UNAVAILABLE}`}</Note>
        </Section>
      )}
    </div>
  )
}
