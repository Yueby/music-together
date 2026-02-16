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
import { SERVER_URL } from '@/lib/config'
import { useRoomStore } from '@/stores/roomStore'
import type { MusicSource, Track } from '@music-together/shared'
import { Loader2, Music2, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

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
  const abortRef = useRef<AbortController | null>(null)
  const loadMoreAbortRef = useRef<AbortController | null>(null)
  const searchIdRef = useRef(0)
  const listRef = useRef<VirtualTrackListRef>(null)
  const queue = useRoomStore((s) => s.room?.queue ?? EMPTY_QUEUE)
  const trackKey = (t: Track) => `${t.source}:${t.sourceId}`
  const queueKeys = useMemo(() => new Set(queue.map(trackKey)), [queue])

  // Cancel any in-flight requests on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      loadMoreAbortRef.current?.abort()
    }
  }, [])

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

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const currentSearchId = ++searchIdRef.current

    setLoading(true)
    setHasSearched(true)
    setAddedIds(new Set())
    try {
      const data = await fetchPage(source, searchKeyword, 1, controller.signal)
      if (searchIdRef.current !== currentSearchId) return
      setResults(data.tracks)
      setPage(1)
      setHasMore(data.hasMore)
      listRef.current?.scrollToTop()
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

  const handleLoadMore = useCallback(() => {
    if (loadingMore) return
    loadMoreAbortRef.current?.abort()
    const controller = new AbortController()
    loadMoreAbortRef.current = controller
    const currentSearchId = searchIdRef.current

    setLoadingMore(true)
    const nextPage = page + 1

    fetchPage(source, keyword.trim(), nextPage, controller.signal)
      .then((data) => {
        if (searchIdRef.current !== currentSearchId) return
        setResults((prev) => [...prev, ...data.tracks])
        setPage(nextPage)
        setHasMore(data.hasMore)
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (searchIdRef.current !== currentSearchId) return
        toast.error('加载失败，请重试')
      })
      .finally(() => {
        if (searchIdRef.current === currentSearchId) {
          setLoadingMore(false)
        }
      })
  }, [loadingMore, page, source, keyword, fetchPage])

  const handleAdd = useCallback((track: Track) => {
    onAddToQueue(track)
    setAddedIds((prev) => new Set(prev).add(trackKey(track)))
    toast.success(`已添加: ${track.title}`)
  }, [onAddToQueue])

  const isTrackAdded = useCallback((track: Track) => {
    return addedIds.has(trackKey(track)) || queueKeys.has(trackKey(track))
  }, [addedIds, queueKeys])

  const resetState = () => {
    setResults([])
    setAddedIds(new Set())
    setPage(1)
    setHasMore(false)
    setHasSearched(false)
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
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

          {/* Results area — virtual scrolling with auto-load */}
          {hasSearched ? (
            <VirtualTrackList
              ref={listRef}
              tracks={results}
              loading={loading}
              hasMore={hasMore}
              loadingMore={loadingMore}
              onLoadMore={handleLoadMore}
              isTrackAdded={isTrackAdded}
              onAddTrack={handleAdd}
              onArtistClick={handleSearch}
              emptyIcon={<Music2 className="h-8 w-8" />}
              emptyMessage="暂无结果，换个关键词试试"
            />
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
              <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
                <Music2 className="h-8 w-8" />
                <span className="text-sm">输入关键词开始搜索</span>
              </div>
            </div>
          )}
        </ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
