import { ArtworkImage } from '@/components/ArtworkImage'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ArtistLoadError } from '@/hooks/useArtist'
import { CLIPPING_PANE } from '@/lib/utils'
import type { Artist, Playlist, Track } from '@music-together/shared'
import { Disc3, Loader2, User } from 'lucide-react'
import { useState } from 'react'
import { CollectionRow } from '../Overlays/CollectionRow'
import { TrackCollection } from './TrackCollection'

const ERROR_MESSAGES: Record<ArtistLoadError, string> = {
  unsupported: '当前平台暂不支持歌手主页',
  'not-found': '没有找到这位歌手',
  failed: '加载失败，请稍后重试',
}

interface ArtistPageProps {
  artist: Artist | null
  loading: boolean
  error: ArtistLoadError | null
  songs: Track[]
  songsTotal: number
  songsHasMore: boolean
  songsLoadingMore: boolean
  albums: Playlist[]
  albumsHasMore: boolean
  albumsLoadingMore: boolean
  onRetry: () => void
  onAddTrack: (track: Track) => void
  onInsertAfterCurrent?: (track: Track) => void
  onAddAll: (tracks: Track[], name?: string) => void
  onLoadMoreSongs: () => void
  onLoadMoreAlbums: () => void
  onSelectAlbum: (album: Playlist) => void
}

function ArtistHeader({ artist, loading }: { artist: Artist | null; loading: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const description = artist?.description
  const counts = [
    artist?.songCount != null ? `${artist.songCount} 首歌曲` : null,
    artist?.albumCount != null ? `${artist.albumCount} 张专辑` : null,
  ].filter(Boolean)
  return (
    <div className="flex shrink-0 gap-3 py-2">
      <ArtworkImage
        cover={artist?.thumbnailCover ?? artist?.cover}
        pending={loading && !artist}
        alt={artist?.name}
        fallback={<User className="text-muted-foreground h-6 w-6" />}
        className="size-14 rounded-full sm:size-16"
      />
      <div className="min-w-0 flex-1 space-y-1">
        {artist ? (
          <>
            <p className="text-muted-foreground text-xs">{counts.join(' · ')}</p>
            {description ? (
              <div>
                <p className={expanded ? 'text-xs whitespace-pre-line' : 'line-clamp-2 text-xs'}>{description}</p>
                {description.length > 60 ? (
                  <button
                    type="button"
                    className="text-primary mt-0.5 text-xs"
                    onClick={() => setExpanded((value) => !value)}
                  >
                    {expanded ? '收起' : '展开'}
                  </button>
                ) : null}
              </div>
            ) : loading ? (
              <Skeleton className="h-3 w-2/3" />
            ) : null}
          </>
        ) : (
          <Skeleton className="h-4 w-1/2" />
        )}
      </div>
    </div>
  )
}

/**
 * An artist's home: profile, hottest songs and albums. Songs reuse the shared collection list; albums open their own
 * page. A page of its own: the dialog that holds it supplies the title (the artist's name) and any way back.
 */
export function ArtistPage({
  artist,
  loading,
  error,
  songs,
  songsTotal,
  songsHasMore,
  songsLoadingMore,
  albums,
  albumsHasMore,
  albumsLoadingMore,
  onRetry,
  onAddTrack,
  onInsertAfterCurrent,
  onAddAll,
  onLoadMoreSongs,
  onLoadMoreAlbums,
  onSelectAlbum,
}: ArtistPageProps) {
  const [tab, setTab] = useState<'songs' | 'albums'>('songs')

  return (
    <div className={CLIPPING_PANE}>
      {error ? (
        <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 py-8 text-sm">
          <span>{ERROR_MESSAGES[error]}</span>
          {error === 'failed' ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              重试
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <ArtistHeader artist={artist} loading={loading} />

          <Tabs value={tab} onValueChange={(value) => setTab(value as 'songs' | 'albums')} className="shrink-0">
            <TabsList className="w-full">
              <TabsTrigger value="songs" className="flex-1 text-xs sm:text-sm">
                热门歌曲
              </TabsTrigger>
              <TabsTrigger value="albums" className="flex-1 text-xs sm:text-sm">
                专辑
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* flex column so the list below gets a definite height from the dialog, not from its own rows */}
          <div className="mt-2 flex min-h-0 flex-1 flex-col">
            {tab === 'songs' ? (
              <TrackCollection
                tracks={songs}
                loading={loading && songs.length === 0}
                loadingMore={songsLoadingMore}
                hasMore={songsHasMore}
                total={songsTotal}
                collectionName={artist?.name}
                emptyMessage="暂无歌曲"
                onAddTrack={onAddTrack}
                onInsertAfterCurrent={onInsertAfterCurrent}
                onAddAll={onAddAll}
                onLoadMore={onLoadMoreSongs}
              />
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto rounded-md border p-2">
                {loading && albums.length === 0 ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }, (_, index) => (
                      <Skeleton key={index} className="h-12 w-full" />
                    ))}
                  </div>
                ) : albums.length === 0 ? (
                  <div className="text-muted-foreground flex h-40 flex-col items-center justify-center gap-2">
                    <Disc3 className="h-8 w-8" />
                    <span className="text-sm">暂无专辑</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {albums.map((album) => (
                      <CollectionRow
                        key={album.id}
                        title={album.name}
                        subtitle={`${album.trackCount} 首${album.creator ? ` · ${album.creator}` : ''}`}
                        cover={album.thumbnailCover ?? album.cover}
                        fallback={<Disc3 className="text-muted-foreground size-5" />}
                        onClick={() => onSelectAlbum(album)}
                      />
                    ))}
                    {albumsHasMore ? (
                      <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={onLoadMoreAlbums} disabled={albumsLoadingMore}>
                        {albumsLoadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {albumsLoadingMore ? '加载中...' : '加载更多'}
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
