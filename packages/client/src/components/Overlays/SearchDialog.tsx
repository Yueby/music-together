import { DialogNavBar, DialogPageTransition } from '@/components/DialogNav'
import { EmptyState } from '@/components/EmptyState'
import { PlaylistPage } from '@/components/Pages/PlaylistPage'
import { useDialogPages } from '@/hooks/useDialogPages'
import { Button } from '@/components/ui/button'
import {
  DIALOG_BODY_CLASS,
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
} from '@/components/ui/responsive-dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { VirtualTrackList, type VirtualTrackListRef } from '@/components/VirtualTrackList'
import { PlatformSelect } from '@/components/PlatformSelect'
import { hasArtistPages } from '@/lib/artistLink'
import { cn } from '@/lib/utils'
import { openArtistPage } from '@/stores/artistPageStore'
import { useSearch, type SearchType } from '@/hooks/useSearch'
import { usePlaylist } from '@/hooks/usePlaylist'
import { useQueueMembership } from '@/hooks/useQueueMembership'
import { useSocketContext } from '@/providers/SocketProvider'
import { EVENTS, parseMusicLink, supportsIdLookup } from '@music-together/shared'
import type { Artist, MusicSource, Track, Playlist } from '@music-together/shared'
import { Loader2, Music2, Search, ListMusic, User } from 'lucide-react'
import { useCallback, useRef, useState, useEffect } from 'react'
import { CollectionRow } from './CollectionRow'

// An id or a share link works in the same box: it is looked up directly (names are not always findable).
const PLACEHOLDERS: Record<SearchType, string> = {
  song: '搜索歌曲、歌手，或粘贴 ID / 分享链接...',
  artist: '搜索歌手，或粘贴 ID / 分享链接...',
  album: '搜索专辑，或粘贴 ID / 分享链接...',
  playlist: '搜索歌单，或粘贴 ID / 分享链接...',
}

/** An album or playlist opened from the results. */
interface AlbumPage {
  title: string
  album: Playlist
}

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddToQueue: (track: Track) => void
  onInsertAfterCurrent: (track: Track) => void
}

export function SearchDialog({ open, onOpenChange, onAddToQueue, onInsertAfterCurrent }: SearchDialogProps) {
  const [source, setSource] = useState<MusicSource>('netease')
  const [searchType, setSearchType] = useState<SearchType>('song')
  const [keyword, setKeyword] = useState('')
  const listRef = useRef<VirtualTrackListRef>(null)
  const { isAdded: isTrackAdded, markPending, addOnce } = useQueueMembership()
  const { socket } = useSocketContext()

  // One level in: an album or playlist opened from the results, named in the title bar. (An artist opens the app's
  // artist page, on top of this dialog.)
  const pages = useDialogPages<AlbumPage>()
  const page = pages.current
  const supportsArtists = hasArtistPages(source)
  const {
    playlistTracks,
    playlistTotal,
    tracksLoading,
    loadingMore: albumLoadingMore,
    hasMoreTracks,
    fetchPlaylistTracks,
    loadMoreTracks,
  } = usePlaylist()

  const { results, loading, loadingMore, hasMore, hasSearched, search, loadMore, resetState } = useSearch(
    source,
    searchType,
  )

  // Compact until something has been searched or opened, then as tall as the other dialogs. Both heights are fixed
  // lengths so the change animates; it stays tall afterwards (switching the type clears the results, which must not
  // shrink the dialog just to grow it again).
  const [expanded, setExpanded] = useState(false)
  if ((hasSearched || page) && !expanded) setExpanded(true)

  // Auto re-search when source or type changes
  const prevSourceRef = useRef(source)
  const prevTypeRef = useRef(searchType)
  useEffect(() => {
    const sourceChanged = prevSourceRef.current !== source
    const typeChanged = prevTypeRef.current !== searchType
    prevSourceRef.current = source
    prevTypeRef.current = searchType
    if ((sourceChanged || typeChanged) && keyword.trim()) {
      search(keyword.trim())
      if (searchType === 'song') listRef.current?.scrollToTop()
    }
  }, [source, searchType, keyword, search])

  const handleSourceChange = (next: MusicSource) => {
    setSource(next)
    // Artist search exists for NetEase only
    if (searchType === 'artist' && !hasArtistPages(next)) setSearchType('song')
    resetState()
  }

  // Back to the search itself when the dialog closes
  const { reset: backToSearch } = pages
  useEffect(() => {
    if (!open) backToSearch()
  }, [open, backToSearch])

  const handleSearch = (overrideKeyword?: string) => {
    const searchKeyword = (overrideKeyword ?? keyword).trim()
    if (!searchKeyword) return
    if (overrideKeyword !== undefined) setKeyword(overrideKeyword)
    // A pasted share link says which platform and kind it is for: follow it (the re-search effect above does the work)
    const link = parseMusicLink(searchKeyword)
    if (link && supportsIdLookup(link.source, link.kind) && (link.source !== source || link.kind !== searchType)) {
      // Results of the old type must not be drawn as the new one while the new search is on its way
      resetState()
      setSource(link.source)
      setSearchType(link.kind)
      return
    }
    search(searchKeyword)
    if (searchType === 'song') {
      listRef.current?.scrollToTop()
    }
  }

  const handleAdd = useCallback((track: Track) => addOnce(track, onAddToQueue), [addOnce, onAddToQueue])

  const handleInsertAfterCurrent = useCallback(
    (track: Track) => addOnce(track, onInsertAfterCurrent),
    [addOnce, onInsertAfterCurrent],
  )

  // "Add all" lists (album, playlist) report their own result; this only sends the songs.
  const handleAddBatch = useCallback(
    (tracks: Track[], playlistName?: string) => {
      if (tracks.length === 0) return
      socket.emit(EVENTS.QUEUE_ADD_BATCH, { tracks, playlistName })
      markPending(tracks)
    },
    [socket, markPending],
  )

  const handleSelectAlbum = (album: Playlist, type: 'album' | 'playlist') => {
    pages.open({ title: album.name, album })
    fetchPlaylistTracks(source, album.id, album.trackCount, type)
  }

  const handleSelectArtist = (artist: Artist) => openArtistPage({ source, id: artist.id, name: artist.name })

  /** A song row's artist name on a platform without artist pages (elsewhere the name opens the page): search its songs. */
  const handleUnsupportedArtistClick = (name: string) => {
    setSearchType('song')
    handleSearch(name)
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent
        className={cn(
          'flex h-[70vh] flex-col gap-0 overflow-hidden p-0 transition-[height] [transition-duration:300ms] motion-reduce:transition-none sm:max-h-[80vh] sm:max-w-2xl',
          expanded ? 'sm:h-[70vh]' : 'sm:h-[25rem]',
        )}
      >
        <DialogNavBar
          title={page?.title ?? '搜索点歌'}
          description="按名称、ID 或分享链接查找歌曲"
          onBack={page ? pages.back : undefined}
        >
          {!page && <PlatformSelect value={source} onChange={handleSourceChange} />}
        </DialogNavBar>

        {/* The padding leaves room for the focus ring of the input, button and tabs, which is drawn outside them */}
        <ResponsiveDialogBody className={cn(DIALOG_BODY_CLASS, 'flex min-h-0 flex-1 flex-col')}>
          <DialogPageTransition pageKey={page ? `album:${page.album.id}` : 'search'}>
            {page ? (
              <PlaylistPage
                playlist={page.album}
                tracks={playlistTracks}
                loading={tracksLoading}
                loadingMore={albumLoadingMore}
                hasMore={hasMoreTracks}
                total={playlistTotal}
                onAddTrack={handleAdd}
                onInsertAfterCurrent={handleInsertAfterCurrent}
                onAddAll={handleAddBatch}
                onLoadMore={loadMoreTracks}
              />
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-4">
                {/* Search input */}
                <div className="flex gap-2">
                  <Input
                    placeholder={PLACEHOLDERS[searchType]}
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="flex-1"
                    autoFocus
                    aria-label="搜索关键词"
                  />
                  <Button onClick={() => handleSearch()} disabled={loading} aria-label="搜索">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>

                {/* What to search for: a filter of the results below, so it sits between the input and them */}
                <Tabs
                  value={searchType}
                  onValueChange={(v) => {
                    setSearchType(v as SearchType)
                    resetState()
                  }}
                >
                  <TabsList variant="nav" aria-label="搜索类型" className="w-full justify-start">
                    <TabsTrigger value="song">单曲</TabsTrigger>
                    {supportsArtists && <TabsTrigger value="artist">歌手</TabsTrigger>}
                    <TabsTrigger value="album">专辑</TabsTrigger>
                    <TabsTrigger value="playlist">歌单</TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Results area — virtual scrolling with auto-load */}
                {hasSearched ? (
                  searchType === 'song' ? (
                    <VirtualTrackList
                      ref={listRef}
                      tracks={results as Track[]}
                      loading={loading}
                      hasMore={hasMore}
                      loadingMore={loadingMore}
                      onLoadMore={loadMore}
                      isTrackAdded={isTrackAdded}
                      onAddTrack={handleAdd}
                      onInsertAfterCurrent={handleInsertAfterCurrent}
                      onUnsupportedArtistClick={handleUnsupportedArtistClick}
                      emptyIcon={<Music2 className="h-8 w-8" />}
                      emptyMessage="暂无结果，换个关键词试试"
                    />
                  ) : (
                    <div className="min-h-0 flex-1 overflow-y-auto rounded-md border p-2">
                      {loading && results.length === 0 ? (
                        <div className="flex h-full items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : results.length === 0 ? (
                        <EmptyState icon={<Music2 className="h-8 w-8" />} message="暂无结果，换个关键词试试" />
                      ) : (
                        <div className="flex flex-col gap-2">
                          {searchType === 'artist'
                            ? (results as Artist[]).map((artist, index) => (
                                <CollectionRow
                                  key={`${artist.id}-${index}`}
                                  round
                                  title={artist.name}
                                  subtitle={[
                                    artist.songCount != null ? `${artist.songCount} 首歌曲` : null,
                                    artist.albumCount != null ? `${artist.albumCount} 张专辑` : null,
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                                  cover={artist.thumbnailCover ?? artist.cover}
                                  fallback={<User className="text-muted-foreground size-5" />}
                                  onClick={() => handleSelectArtist(artist)}
                                />
                              ))
                            : (results as Playlist[]).map((album, index) => (
                                <CollectionRow
                                  key={`${album.id}-${index}`}
                                  title={album.name}
                                  subtitle={`${album.trackCount} 首${album.creator ? ` · ${album.creator}` : ''}`}
                                  cover={album.thumbnailCover ?? album.cover}
                                  fallback={<ListMusic className="text-muted-foreground size-5" />}
                                  onClick={() =>
                                    handleSelectAlbum(album, searchType === 'album' ? 'album' : 'playlist')
                                  }
                                />
                              ))}
                          {hasMore && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full mt-2"
                              onClick={loadMore}
                              disabled={loadingMore}
                            >
                              {loadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              {loadingMore ? '加载中...' : '加载更多'}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
                    <EmptyState icon={<Music2 className="h-8 w-8" />} message="输入关键词开始搜索" />
                  </div>
                )}
              </div>
            )}
          </DialogPageTransition>
        </ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
