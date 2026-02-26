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
import { PLATFORM_COLORS } from '@/lib/platform'
import { trackKey } from '@/lib/utils'
import { useRoomStore } from '@/stores/roomStore'
import { useSearch } from '@/hooks/useSearch'
import type { MusicSource, Track } from '@music-together/shared'
import { Loader2, Music2, Search } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

const EMPTY_QUEUE: Track[] = []

const SOURCES: { id: MusicSource; label: string }[] = [
  { id: 'netease', label: '网易云' },
  { id: 'tencent', label: 'QQ音乐' },
  { id: 'kugou', label: '酷狗' },
]

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddToQueue: (track: Track) => void
}

export function SearchDialog({ open, onOpenChange, onAddToQueue }: SearchDialogProps) {
  const [source, setSource] = useState<MusicSource>('netease')
  const [keyword, setKeyword] = useState('')
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const listRef = useRef<VirtualTrackListRef>(null)
  const queue = useRoomStore((s) => s.room?.queue ?? EMPTY_QUEUE)
  const queueKeys = useMemo(() => new Set(queue.map(trackKey)), [queue])

  const { results, loading, loadingMore, hasMore, hasSearched, search, loadMore, resetState } = useSearch(source)

  const handleSearch = (overrideKeyword?: string) => {
    const searchKeyword = (overrideKeyword ?? keyword).trim()
    if (!searchKeyword) return
    if (overrideKeyword !== undefined) setKeyword(overrideKeyword)
    setAddedIds(new Set())
    search(searchKeyword)
    listRef.current?.scrollToTop()
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
      toast.success(`已添加「${track.title}」`)
    },
    [onAddToQueue, queueKeys, addedIds],
  )

  const isTrackAdded = useCallback(
    (track: Track) => {
      const key = trackKey(track)
      return addedIds.has(key) || queueKeys.has(key)
    },
    [addedIds, queueKeys],
  )

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
              setAddedIds(new Set())
            }}
          >
            <TabsList className="w-full">
              {SOURCES.map((s) => (
                <TabsTrigger key={s.id} value={s.id} className={`flex-1 text-xs sm:text-sm ${PLATFORM_COLORS[s.id]}`}>
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
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
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
              onLoadMore={loadMore}
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
