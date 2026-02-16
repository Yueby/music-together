import { Button } from '@/components/ui/button'
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SERVER_URL } from '@/lib/config'
import { useRoomStore } from '@/stores/roomStore'
import type { MusicSource, Track } from '@music-together/shared'
import { Loader2, Music2, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { SearchResultItem } from './Search/SearchResultItem'

const EMPTY_QUEUE: Track[] = []

const SOURCES: { id: MusicSource; label: string }[] = [
  { id: 'netease', label: '网易云' },
  { id: 'tencent', label: 'QQ音乐' },
  { id: 'kugou', label: '酷狗' },
]

const PAGE_SIZE = 20

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddToQueue: (track: Track) => void
}

export function SearchDialog({ open, onOpenChange, onAddToQueue }: SearchDialogProps) {
  const [source, setSource] = useState<MusicSource>('netease')
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<Track[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const loadMoreAbortRef = useRef<AbortController | null>(null)
  const searchIdRef = useRef(0)
  const queue = useRoomStore((s) => s.room?.queue ?? EMPTY_QUEUE)
  /** Use stable source:sourceId as key instead of nanoid-generated track.id */
  const trackKey = (t: Track) => `${t.source}:${t.sourceId}`
  const queueKeys = useMemo(() => new Set(queue.map(trackKey)), [queue])

  // Cancel any in-flight requests on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      loadMoreAbortRef.current?.abort()
    }
  }, [])

  /** Shared fetch logic for both initial search and load-more */
  const fetchPage = useCallback(async (
    searchSource: MusicSource,
    searchKeyword: string,
    searchPage: number,
    signal: AbortSignal,
  ): Promise<{ tracks: Track[]; hasMore: boolean }> => {
    const res = await fetch(
      `${SERVER_URL}/api/music/search?source=${searchSource}&keyword=${encodeURIComponent(searchKeyword)}&limit=${PAGE_SIZE}&page=${searchPage}`,
      { signal },
    )
    if (!res.ok) throw new Error('Search failed')
    const data = await res.json()
    const tracks: Track[] = data.tracks || []
    return { tracks, hasMore: data.hasMore ?? tracks.length >= PAGE_SIZE }
  }, [])

  const handleSearch = async (overrideKeyword?: string) => {
    const searchKeyword = (overrideKeyword ?? keyword).trim()
    if (!searchKeyword) return
    if (overrideKeyword !== undefined) {
      setKeyword(overrideKeyword)
    }

    // Abort previous request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const currentSearchId = ++searchIdRef.current

    setLoading(true)
    setHasSearched(true)
    setAddedIds(new Set())
    try {
      const data = await fetchPage(source, searchKeyword, 1, controller.signal)
      // Stale response guard
      if (searchIdRef.current !== currentSearchId) return
      setResults(data.tracks)
      setPage(1)
      setHasMore(data.hasMore)
      scrollRef.current?.scrollTo({ top: 0 })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (searchIdRef.current !== currentSearchId) return
      toast.error('搜索失败，请重试')
      setResults([])
      setHasMore(false)
    } finally {
      if (searchIdRef.current === currentSearchId) {
        setLoading(false)
      }
    }
  }

  const handleLoadMore = async () => {
    loadMoreAbortRef.current?.abort()
    const controller = new AbortController()
    loadMoreAbortRef.current = controller
    const currentSearchId = searchIdRef.current
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      const data = await fetchPage(source, keyword.trim(), nextPage, controller.signal)
      // Stale response guard
      if (searchIdRef.current !== currentSearchId) return
      setResults((prev) => [...prev, ...data.tracks])
      setPage(nextPage)
      setHasMore(data.hasMore)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (searchIdRef.current !== currentSearchId) return
      toast.error('加载失败，请重试')
    } finally {
      if (searchIdRef.current === currentSearchId) {
        setLoadingMore(false)
      }
    }
  }

  const handleAdd = (track: Track) => {
    onAddToQueue(track)
    setAddedIds((prev) => new Set(prev).add(trackKey(track)))
    toast.success(`已添加: ${track.title}`)
  }

  const resetState = () => {
    setResults([])
    setAddedIds(new Set())
    setPage(1)
    setHasMore(false)
    setHasSearched(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent className="flex h-[70vh] flex-col overflow-hidden sm:h-auto sm:max-h-[80vh] sm:max-w-2xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>搜索点歌</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          {/* Source tabs */}
          <Tabs
            value={source}
            onValueChange={(v) => {
              setSource(v as MusicSource)
              resetState()
            }}
          >
            <TabsList className="w-full">
              {SOURCES.map((s) => (
                <TabsTrigger key={s.id} value={s.id} className="flex-1 text-xs sm:text-sm">
                  {s.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Search input */}
          <div className="flex gap-2">
            <Input
              placeholder="搜索歌曲、歌手..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
              autoFocus
              aria-label="搜索关键词"
            />
            <Button onClick={() => handleSearch()} disabled={loading} aria-label="搜索">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Results area - scrollable */}
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto rounded-md border">
            {loading ? (
              <div className="divide-y">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                    <Skeleton className="h-4 w-6" />
                    <Skeleton className="h-10 w-10 rounded" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </div>
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
                <Music2 className="h-8 w-8" />
                <span className="text-sm">
                  {hasSearched ? '暂无结果，换个关键词试试' : '输入关键词开始搜索'}
                </span>
              </div>
            ) : (
              <div className="divide-y">
                {results.map((track, i) => (
                  <SearchResultItem
                    key={`${track.id}-${i}`}
                    track={track}
                    index={i}
                    isAdded={addedIds.has(trackKey(track)) || queueKeys.has(trackKey(track))}
                    onAdd={handleAdd}
                    onSearchArtist={handleSearch}
                  />
                ))}

                {/* Load more */}
                {hasMore && (
                  <div className="flex justify-center py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="text-muted-foreground"
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          加载中...
                        </>
                      ) : (
                        '加载更多'
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
