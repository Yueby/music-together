import { Button } from '@/components/ui/button'
import { PLATFORM_LABELS } from '@/lib/platform'
import type { MusicSource, MyPlatformAuth, Playlist } from '@music-together/shared'
import { ListMusic, RefreshCw } from 'lucide-react'
import { useEffect } from 'react'
import { CoverCard, CoverGrid } from '../CoverCard'
import { GridSkeleton, Note, Section } from './DiscoverSections'

interface PlaylistSectionProps {
  platform: MusicSource
  myStatus?: MyPlatformAuth
  /** Still waiting for the server to confirm a saved login. */
  verifying: boolean
  playlists: Playlist[]
  loading: boolean
  onFetchMyPlaylists: () => void
  onSelectPlaylist: (playlist: Playlist) => void
}

/** The user's own playlists on one platform as a cover grid. Without a login it asks for one instead of showing nothing. */
export function PlaylistSection({
  platform,
  myStatus,
  verifying,
  playlists,
  loading,
  onFetchMyPlaylists,
  onSelectPlaylist,
}: PlaylistSectionProps) {
  const isLoggedIn = myStatus?.loggedIn ?? false

  // Auto-fetch playlists when logged in and no playlists loaded
  useEffect(() => {
    if (isLoggedIn && playlists.length === 0 && !loading) {
      onFetchMyPlaylists()
    }
  }, [isLoggedIn, playlists.length, loading, onFetchMyPlaylists])

  if (!isLoggedIn) {
    return (
      <Section title="我的歌单">
        {verifying ? (
          <GridSkeleton count={5} />
        ) : (
          <Note>{`登录${PLATFORM_LABELS[platform]}后可以查看和点播自己的歌单`}</Note>
        )}
      </Section>
    )
  }

  return (
    <Section
      title="我的歌单"
      subtitle={playlists.length > 0 ? `共 ${playlists.length} 个歌单` : undefined}
      action={
        <Button
          variant="ghost"
          size="sm"
          onClick={onFetchMyPlaylists}
          disabled={loading}
          className="text-muted-foreground min-h-11 shrink-0 gap-1 px-2 text-xs sm:h-7 sm:min-h-0"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      }
    >
      {loading && playlists.length === 0 ? (
        <GridSkeleton count={5} />
      ) : playlists.length > 0 ? (
        <CoverGrid>
          {playlists.map((pl) => (
            <CoverCard
              key={pl.id}
              title={pl.name}
              subtitle={`${pl.trackCount} 首${pl.creator ? ` · ${pl.creator}` : ''}`}
              cover={pl.thumbnailCover ?? pl.cover}
              fallback={<ListMusic className="text-muted-foreground size-8" />}
              onClick={() => onSelectPlaylist(pl)}
            />
          ))}
        </CoverGrid>
      ) : (
        <Note>暂无歌单</Note>
      )}
    </Section>
  )
}
