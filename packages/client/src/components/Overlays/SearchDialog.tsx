import { Button } from '@/components/ui/button'
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { VirtualTrackList, type VirtualTrackListRef } from '@/components/VirtualTrackList'
import { PLATFORM_ACTIVE, PLATFORM_TEXT } from '@/lib/platform'
import { cn, trackKey } from '@/lib/utils'
import { hostRuntime } from '@/lib/hostRuntime'
import { useRoomStore } from '@/stores/roomStore'
import { useSearch } from '@/hooks/useSearch'
import { usePlaylist } from '@/hooks/usePlaylist'
import { useSocketContext } from '@/providers/SocketProvider'
import { EVENTS } from '@music-together/shared'
import type { MusicSource, Track, Playlist } from '@music-together/shared'
import { Loader2, Music2, Search, ListMusic } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useLayoutEffect, useMemo, useRef, useState, useEffect } from 'react'
import { toast } from 'sonner'
import { PlaylistDetail } from './Settings/PlaylistDetail'

const EMPTY_QUEUE: Track[] = []

const SOURCES: { id: MusicSource; label: string }[] = [
  { id: 'netease', label: '网易云' },
  { id: 'tencent', label: 'QQ' },
  { id: 'kugou', label: '酷狗' },
]

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddToQueue: (track: Track) => void
  onInsertAfterCurrent: (track: Track) => void
}

export function SearchDialog({ open, onOpenChange, onAddToQueue, onInsertAfterCurrent }: SearchDialogProps) {
  const [source, setSource] = useState<MusicSource>('netease')
  const [searchType, setSearchType] = useState<'song' | 'album' | 'playlist'>('song')
  const [keyword, setKeyword] = useState('')
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const listRef = useRef<VirtualTrackListRef>(null)
  const sourceContainerRef = useRef<HTMLDivElement>(null)
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 })
  const queue = useRoomStore((s) => s.room?.queue ?? EMPTY_QUEUE)
  const queueKeys = useMemo(() => new Set(queue.map(trackKey)), [queue])
  const { socket } = useSocketContext()

  // Album Detail view state
  const [selectedAlbum, setSelectedAlbum] = useState<Playlist | null>(null)
  const {
    playlistTracks,
    playlistTotal,
    tracksLoading,
    loadingMore: albumLoadingMore,
    hasMoreTracks,
    fetchPlaylistTracks,
    loadMoreTracks,
  } = usePlaylist()

  const { results, loading, loadingMore, hasMore, hasSearched, search, loadMore, resetState } = useSearch(source, searchType)

  // Auto re-search when source or type changes
  const prevSourceRef = useRef(source)
  const prevTypeRef = useRef(searchType)
  useEffect(() => {
    const sourceChanged = prevSourceRef.current !== source
    const typeChanged = prevTypeRef.current !== searchType
    prevSourceRef.current = source
    prevTypeRef.current = searchType
    if ((sourceChanged || typeChanged) && keyword.trim()) {
      setAddedIds(new Set())
      search(keyword.trim())
      if (searchType === 'song') listRef.current?.scrollToTop()
    }
  }, [source, searchType, keyword, search])

  // Measure active source button position for sliding pill
  const measurePill = useCallback(() => {
    const container = sourceContainerRef.current
    if (!container) return
    const activeBtn = container.querySelector<HTMLButtonElement>(`[data-source="${source}"]`)
    if (!activeBtn) return
    setPillStyle({ left: activeBtn.offsetLeft, width: activeBtn.offsetWidth })
  }, [source])

  useLayoutEffect(() => {
    measurePill()
  }, [measurePill])

  // Re-measure after dialog opens (DOM may not be ready on first render)
  useEffect(() => {
    if (open) requestAnimationFrame(measurePill)
  }, [open, measurePill])

  // Reset album detail when dialog closes
  useEffect(() => {
    if (!open) setSelectedAlbum(null)
  }, [open])

  const handleSearch = (overrideKeyword?: string) => {
    const searchKeyword = (overrideKeyword ?? keyword).trim()
    if (!searchKeyword) return
    if (overrideKeyword !== undefined) setKeyword(overrideKeyword)
    setAddedIds(new Set())
    search(searchKeyword)
    if (searchType === 'song') {
      listRef.current?.scrollToTop()
    }
  }

  const handleAdd = useCallback(
    (track: Track) => {
      const key = trackKey(track)
      if (queueKeys.has(key) || addedIds.has(key)) {
        toast.info(`「${track.title}」已在队列中`)
        return
      }
      onAddToQueue(track)
      setAddedIds((prev) => new Set(prev).add(key))
      // Removed duplicate toast.success since onAddToQueue (from useQueue) usually already handles it 
      // or the UI handles feedback.
    },
    [onAddToQueue, queueKeys, addedIds],
  )

  const handleInsertAfterCurrent = useCallback(
    (track: Track) => {
      const key = trackKey(track)
      if (queueKeys.has(key) || addedIds.has(key)) {
        toast.info(`「${track.title}」已在队列中`)
        return
      }
      onInsertAfterCurrent(track)
      setAddedIds((prev) => new Set(prev).add(key))
      // Removed duplicate toast.success
    },
    [onInsertAfterCurrent, queueKeys, addedIds],
  )

  const handleAddBatch = useCallback(
    (tracks: Track[], playlistName?: string) => {
      if (tracks.length === 0) return
      socket.emit(EVENTS.QUEUE_ADD_BATCH, { tracks, playlistName })
      setAddedIds((prev) => {
        const next = new Set(prev)
        for (const t of tracks) next.add(trackKey(t))
        return next
      })
      toast.success(`已添加 ${tracks.length} 首歌曲`)
    },
    [socket]
  )

  const isTrackAdded = useCallback(
    (track: Track) => {
      const key = trackKey(track)
      return addedIds.has(key) || queueKeys.has(key)
    },
    [addedIds, queueKeys],
  )

  const handleSelectAlbum = (album: Playlist) => {
    if (!hostRuntime.collections) return
    setSelectedAlbum(album)
    fetchPlaylistTracks(source, album.id, album.trackCount, searchType as 'album' | 'playlist')
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="flex h-[70vh] flex-col overflow-hidden sm:h-auto sm:max-h-[80vh] sm:max-w-2xl">
        <ResponsiveDialogHeader>
          <div className="flex items-center gap-3">
            <ResponsiveDialogTitle className="shrink-0">
              {selectedAlbum ? selectedAlbum.name : '搜索点歌'}
            </ResponsiveDialogTitle>
            {!selectedAlbum && (
              <div ref={sourceContainerRef} className="bg-muted/50 relative flex items-center rounded-lg p-0.5">
                <motion.div
                  className={cn('absolute inset-y-0.5 rounded-md', PLATFORM_ACTIVE[source])}
                  animate={{ left: pillStyle.left, width: pillStyle.width }}
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.3 }}
                />
                {SOURCES.map((s) => (
                  <button
                    key={s.id}
                    data-source={s.id}
                    className={cn(
                      'relative z-10 rounded-md px-2.5 py-0.5 text-xs font-medium transition-colors',
                      source === s.id ? PLATFORM_TEXT[s.id] : 'text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => {
                      setSource(s.id)
                      resetState()
                      setAddedIds(new Set())
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          {selectedAlbum && hostRuntime.collections ? (
            <PlaylistDetail
              playlist={selectedAlbum}
              tracks={playlistTracks}
              loading={tracksLoading}
              loadingMore={albumLoadingMore}
              hasMore={hasMoreTracks}
              total={playlistTotal}
              onBack={() => setSelectedAlbum(null)}
              onAddTrack={handleAdd}
              onInsertAfterCurrent={handleInsertAfterCurrent}
              onAddAll={handleAddBatch}
              onLoadMore={loadMoreTracks}
            />
          ) : (
            <>
              {/* Type tabs */}
              <Tabs
                value={searchType}
                onValueChange={(v) => {
                  if (!hostRuntime.collections && v !== 'song') return
                  setSearchType(v as 'song' | 'album' | 'playlist')
                  resetState()
                  setAddedIds(new Set())
                }}
              >
                <TabsList className="w-full">
                  <TabsTrigger value="song" className="flex-1 text-xs sm:text-sm">单曲</TabsTrigger>
                  {hostRuntime.collections && (
                    <>
                      <TabsTrigger value="album" className="flex-1 text-xs sm:text-sm">专辑</TabsTrigger>
                      <TabsTrigger value="playlist" className="flex-1 text-xs sm:text-sm">歌单</TabsTrigger>
                    </>
                  )}
                </TabsList>
              </Tabs>

              {/* Search input */}
              <div className="flex gap-2">
                <Input
                  placeholder={searchType === 'song' ? '搜索歌曲、歌手...' : searchType === 'album' ? '搜索专辑...' : '搜索歌单...'}
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
                    onArtistClick={(artist) => {
                      setSearchType('song')
                      handleSearch(artist)
                    }}
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
                      <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Music2 className="h-8 w-8" />
                        <span className="text-sm">暂无结果，换个关键词试试</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {(results as Playlist[]).map((album, index) => (
                          <button
                            key={`${album.id}-${index}`}
                            className="hover:bg-accent flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-lg p-2 text-left transition-colors disabled:pointer-events-none disabled:opacity-50"
                            onClick={() => handleSelectAlbum(album)}
                            disabled={!hostRuntime.collections}
                          >
                            {hostRuntime.remoteArtwork && (album.thumbnailCover ?? album.cover) ? (
                              <img
                                src={album.thumbnailCover ?? album.cover}
                                alt={album.name}
                                className="h-12 w-12 shrink-0 rounded-md object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="bg-muted flex h-12 w-12 shrink-0 items-center justify-center rounded-md">
                                <ListMusic className="text-muted-foreground h-5 w-5" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{album.name}</p>
                              <p className="text-muted-foreground truncate text-xs">
                                {album.trackCount} 首{album.creator ? ` · ${album.creator}` : ''}
                              </p>
                            </div>
                          </button>
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
                  <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Music2 className="h-8 w-8" />
                    <span className="text-sm">输入关键词开始搜索</span>
                  </div>
                </div>
              )}
            </>
          )}
        </ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
