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
import { useRoomStore } from '@/stores/roomStore'
import type { MusicSource, Track } from '@music-together/shared'
import { Loader2, Music2, Search } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { SearchResultItem } from './Search/SearchResultItem'

const EMPTY_QUEUE: Track[] = []

const SOURCES: { id: MusicSource; label: string }[] = [
  { id: 'netease', label: '网易云' },
  { id: 'tencent', label: 'QQ音乐' },
  { id: 'kugou', label: '酷狗' },
  { id: 'kuwo', label: '酷我' },
  { id: 'baidu', label: '百度' },
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
  const queue = useRoomStore((s) => s.room?.queue ?? EMPTY_QUEUE)
  const queueIds = useMemo(() => new Set(queue.map((t) => t.id)), [queue])

  const fetchResults = async (searchPage: number, append: boolean) => {
    const { SERVER_URL: serverUrl } = await import('@/lib/config')
    const res = await fetch(
      `${serverUrl}/api/music/search?source=${source}&keyword=${encodeURIComponent(keyword.trim())}&limit=${PAGE_SIZE}&page=${searchPage}`,
    )
    if (!res.ok) throw new Error('Search failed')
    const data = await res.json()
    const tracks: Track[] = data.tracks || []

    if (append) {
      setResults((prev) => [...prev, ...tracks])
    } else {
      setResults(tracks)
    }
    setPage(searchPage)
    setHasMore(data.hasMore ?? tracks.length >= PAGE_SIZE)
  }

  const handleSearch = async (overrideKeyword?: string) => {
    const searchKeyword = overrideKeyword ?? keyword
    if (!searchKeyword.trim()) return
    if (overrideKeyword !== undefined) {
      setKeyword(overrideKeyword)
    }
    setLoading(true)
    setHasSearched(true)
    setAddedIds(new Set())
    try {
      const { SERVER_URL: serverUrl } = await import('@/lib/config')
      const res = await fetch(
        `${serverUrl}/api/music/search?source=${source}&keyword=${encodeURIComponent(searchKeyword.trim())}&limit=${PAGE_SIZE}&page=1`,
      )
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      const tracks: Track[] = data.tracks || []
      setResults(tracks)
      setPage(1)
      setHasMore(data.hasMore ?? tracks.length >= PAGE_SIZE)
      scrollRef.current?.scrollTo({ top: 0 })
    } catch {
      toast.error('搜索失败，请重试')
      setResults([])
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }

  const handleLoadMore = async () => {
    setLoadingMore(true)
    try {
      await fetchResults(page + 1, true)
    } catch {
      toast.error('加载失败，请重试')
    } finally {
      setLoadingMore(false)
    }
  }

  const handleAdd = (track: Track) => {
    onAddToQueue(track)
    setAddedIds((prev) => new Set(prev).add(track.id))
    toast.success(`已添加: ${track.title}`)
  }

  const resetState = () => {
    setResults([])
    setAddedIds(new Set())
    setPage(1)
    setHasMore(false)
    setHasSearched(false)
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-h-[80vh] sm:max-w-2xl">
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
                    isAdded={addedIds.has(track.id) || queueIds.has(track.id)}
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
