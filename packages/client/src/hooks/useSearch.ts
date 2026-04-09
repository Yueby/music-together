import { SERVER_URL } from '@/lib/config'
import type { MusicSource, Track } from '@music-together/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

const PAGE_SIZE = 20

// UseSearchReturn type removed

/**
 * 搜索逻辑 hook — 管理搜索/翻页/abort/竞态保护。
 * 从 SearchDialog 中提取，使 UI 组件只关注渲染。
 */
export function useSearch<T extends 'song' | 'album' = 'song'>(
  source: MusicSource,
  type: T = 'song' as T,
) {
  const [results, setResults] = useState<T extends 'album' ? import('@music-together/shared').Playlist[] : Track[]>(([] as any))
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const loadMoreAbortRef = useRef<AbortController | null>(null)
  const searchIdRef = useRef(0)
  const lastKeywordRef = useRef('')

  // Cancel any in-flight requests on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      loadMoreAbortRef.current?.abort()
    }
  }, [])

  const fetchPage = useCallback(
    async (
      searchSource: MusicSource,
      searchKeyword: string,
      searchPage: number,
      signal: AbortSignal,
      searchType: 'song' | 'album'
    ): Promise<{ tracks: any[]; hasMore: boolean }> => {
      const res = await fetch(
        `${SERVER_URL}/api/music/search?source=${searchSource}&keyword=${encodeURIComponent(searchKeyword)}&limit=${PAGE_SIZE}&page=${searchPage}&type=${searchType}`,
        { signal, credentials: 'include' },
      )
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      const tracks = data.tracks || []
      return { tracks, hasMore: data.hasMore ?? tracks.length >= PAGE_SIZE }
    },
    [],
  )

  const search = useCallback(
    (keyword: string) => {
      const trimmed = keyword.trim()
      if (!trimmed) return

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const currentSearchId = ++searchIdRef.current
      lastKeywordRef.current = trimmed

      setLoading(true)
      setHasSearched(true)
      fetchPage(source, trimmed, 1, controller.signal, type)
        .then((data) => {
          if (searchIdRef.current !== currentSearchId) return
          setResults(data.tracks as any)
          setPage(1)
          setHasMore(data.hasMore)
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === 'AbortError') return
          if (searchIdRef.current !== currentSearchId) return
          toast.error('搜索失败，请重试')
          setResults([] as any)
          setHasMore(false)
        })
        .finally(() => {
          if (searchIdRef.current === currentSearchId) {
            setLoading(false)
          }
        })
    },
    [source, type, fetchPage],
  )

  const loadMore = useCallback(() => {
    if (loadingMore) return
    loadMoreAbortRef.current?.abort()
    const controller = new AbortController()
    loadMoreAbortRef.current = controller
    const currentSearchId = searchIdRef.current
    const nextPage = page + 1

    setLoadingMore(true)
    fetchPage(source, lastKeywordRef.current, nextPage, controller.signal, type)
      .then((data) => {
        if (searchIdRef.current !== currentSearchId) return
        setResults((prev) => [...prev, ...data.tracks] as any)
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
  }, [loadingMore, page, source, type, fetchPage])

  const resetState = useCallback(() => {
    abortRef.current?.abort()
    loadMoreAbortRef.current?.abort()
    searchIdRef.current++
    setResults([] as any)
    setPage(1)
    setHasMore(false)
    setHasSearched(false)
    setLoading(false)
    setLoadingMore(false)
    lastKeywordRef.current = ''
  }, [])

  return { results, loading, loadingMore, hasMore, hasSearched, page, search, loadMore, resetState }
}
