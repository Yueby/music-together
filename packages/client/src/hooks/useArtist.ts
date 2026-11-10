import { SERVER_URL } from '@/lib/config'
import { hostRuntime } from '@/lib/hostRuntime'
import { metadataFetch } from '@/lib/metadataFetch'
import type { Artist, MusicSource, Playlist, Track } from '@music-together/shared'
import { useCallback, useEffect, useRef, useState } from 'react'

const SONG_PAGE_SIZE = 50
const ALBUM_PAGE_SIZE = 30

interface Page<T> {
  items: T[]
  hasMore: boolean
  total?: number
}

interface ArtistHome {
  artist: Artist
  songs: Page<Track>
  albums: Page<Playlist>
}

export type ArtistLoadError = 'unsupported' | 'not-found' | 'failed'

/** Append a page without repeating entries the previous page already returned (hot ranking can shift between calls). */
function appendUnique<T>(current: T[], next: T[], key: (item: T) => string): T[] {
  const seen = new Set(current.map(key))
  return [...current, ...next.filter((item) => !seen.has(key(item)))]
}

async function getJson<T>(path: string, params: Record<string, string | number>, signal: AbortSignal): Promise<T> {
  const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]))
  const res = await metadataFetch(`${SERVER_URL}/api/music/${path}?${query}`, { signal, credentials: 'include' })
  if (!res.ok) {
    const error = new Error(String(res.status))
    ;(error as Error & { status?: number }).status = res.status
    throw error
  }
  return (await res.json()) as T
}

/**
 * Artist home page state: profile, hottest songs and albums, each with its own paging.
 * A newer `load` (or `reset`) invalidates everything still in flight, so a slow artist never overwrites a fresh one.
 */
export function useArtist() {
  const [artist, setArtist] = useState<Artist | null>(null)
  const [songs, setSongs] = useState<Track[]>([])
  const [songsTotal, setSongsTotal] = useState(0)
  const [songsHasMore, setSongsHasMore] = useState(false)
  const [songsLoadingMore, setSongsLoadingMore] = useState(false)
  const [albums, setAlbums] = useState<Playlist[]>([])
  const [albumsHasMore, setAlbumsHasMore] = useState(false)
  const [albumsLoadingMore, setAlbumsLoadingMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ArtistLoadError | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const generationRef = useRef(0)
  const contextRef = useRef<{ source: MusicSource; id: string } | null>(null)
  const loadingSongsRef = useRef(false)
  const loadingAlbumsRef = useRef(false)
  /** How many entries the server has already handed out: the next page starts there, even if duplicates were hidden. */
  const songsOffsetRef = useRef(0)
  const albumsOffsetRef = useRef(0)

  const reset = useCallback(() => {
    abortRef.current?.abort()
    generationRef.current++
    contextRef.current = null
    songsOffsetRef.current = 0
    albumsOffsetRef.current = 0
    loadingSongsRef.current = false
    loadingAlbumsRef.current = false
    setArtist(null)
    setSongs([])
    setSongsTotal(0)
    setSongsHasMore(false)
    setSongsLoadingMore(false)
    setAlbums([])
    setAlbumsHasMore(false)
    setAlbumsLoadingMore(false)
    setLoading(false)
    setError(null)
  }, [])

  useEffect(() => () => abortRef.current?.abort(), [])

  const load = useCallback(
    async (source: MusicSource, id: string, hint?: Artist) => {
      reset()
      if (!hostRuntime.collections) {
        setError('unsupported')
        return
      }
      const controller = new AbortController()
      abortRef.current = controller
      const generation = generationRef.current
      contextRef.current = { source, id }
      // Show what the search result already knew while the full profile loads.
      if (hint) setArtist(hint)
      setLoading(true)
      try {
        const home = await getJson<ArtistHome>('artist', { source, id }, controller.signal)
        if (generationRef.current !== generation) return
        setArtist(home.artist)
        songsOffsetRef.current = home.songs.items.length
        albumsOffsetRef.current = home.albums.items.length
        setSongs(home.songs.items)
        setSongsTotal(home.songs.total ?? home.songs.items.length)
        setSongsHasMore(home.songs.hasMore)
        setAlbums(home.albums.items)
        setAlbumsHasMore(home.albums.hasMore)
      } catch (err) {
        if (generationRef.current !== generation) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        const status = (err as { status?: number }).status
        setError(status === 400 ? 'unsupported' : status === 404 ? 'not-found' : 'failed')
      } finally {
        if (generationRef.current === generation) setLoading(false)
      }
    },
    [reset],
  )

  const loadMoreSongs = useCallback(async () => {
    const context = contextRef.current
    if (!context || loadingSongsRef.current || !songsHasMore) return
    loadingSongsRef.current = true
    setSongsLoadingMore(true)
    const generation = generationRef.current
    const signal = abortRef.current?.signal ?? new AbortController().signal
    try {
      const page = await getJson<Page<Track>>(
        'artist/songs',
        { ...context, offset: songsOffsetRef.current, limit: SONG_PAGE_SIZE },
        signal,
      )
      if (generationRef.current !== generation) return
      songsOffsetRef.current += page.items.length
      setSongs((prev) => appendUnique(prev, page.items, (track) => track.sourceId))
      setSongsHasMore(page.hasMore && page.items.length > 0)
    } catch {
      // Silent: scrolling again retries.
    } finally {
      if (generationRef.current === generation) {
        loadingSongsRef.current = false
        setSongsLoadingMore(false)
      }
    }
  }, [songsHasMore])

  const loadMoreAlbums = useCallback(async () => {
    const context = contextRef.current
    if (!context || loadingAlbumsRef.current || !albumsHasMore) return
    loadingAlbumsRef.current = true
    setAlbumsLoadingMore(true)
    const generation = generationRef.current
    const signal = abortRef.current?.signal ?? new AbortController().signal
    try {
      const page = await getJson<Page<Playlist>>(
        'artist/albums',
        { ...context, offset: albumsOffsetRef.current, limit: ALBUM_PAGE_SIZE },
        signal,
      )
      if (generationRef.current !== generation) return
      albumsOffsetRef.current += page.items.length
      setAlbums((prev) => appendUnique(prev, page.items, (album) => album.id))
      setAlbumsHasMore(page.hasMore && page.items.length > 0)
    } catch {
      // Silent: pressing the button again retries.
    } finally {
      if (generationRef.current === generation) {
        loadingAlbumsRef.current = false
        setAlbumsLoadingMore(false)
      }
    }
  }, [albumsHasMore])

  return {
    artist,
    songs,
    songsTotal,
    songsHasMore,
    songsLoadingMore,
    albums,
    albumsHasMore,
    albumsLoadingMore,
    loading,
    error,
    load,
    loadMoreSongs,
    loadMoreAlbums,
    reset,
  }
}
