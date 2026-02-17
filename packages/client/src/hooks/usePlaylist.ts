import { useCallback, useEffect, useRef, useState } from 'react'
import { EVENTS, type MusicSource, type Playlist, type Track } from '@music-together/shared'
import { useSocketContext } from '@/providers/SocketProvider'
import { useRoomStore } from '@/stores/roomStore'
import { storage } from '@/lib/storage'
import { SERVER_URL } from '@/lib/config'

const PAGE_SIZE = 100

/** Build the playlist API URL with all query parameters */
function buildPlaylistUrl(
  source: MusicSource,
  id: string,
  limit: number,
  offset: number,
  options?: { total?: number; roomId?: string; userId?: string },
): string {
  const params = new URLSearchParams({
    source,
    id,
    limit: String(limit),
    offset: String(offset),
  })
  if (options?.total) params.set('total', String(options.total))
  if (options?.roomId) params.set('roomId', options.roomId)
  if (options?.userId) params.set('userId', options.userId)
  return `${SERVER_URL}/api/music/playlist?${params.toString()}`
}

/**
 * Extract a playlist ID from a URL or raw ID string.
 * Supports common URL formats for netease, tencent, and kugou.
 */
export function parsePlaylistInput(input: string, source: MusicSource): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // If it looks like a plain numeric/alphanumeric ID, return as-is
  if (/^[\w-]+$/.test(trimmed)) return trimmed

  try {
    const url = new URL(trimmed)

    switch (source) {
      case 'netease': {
        // https://music.163.com/playlist?id=12345
        // https://music.163.com/#/playlist?id=12345
        const idParam = url.searchParams.get('id')
        if (idParam) return idParam
        const hashMatch = url.hash.match(/[?&]id=(\d+)/)
        if (hashMatch) return hashMatch[1]
        const pathMatch = url.pathname.match(/\/playlist\/(\d+)/)
        if (pathMatch) return pathMatch[1]
        break
      }
      case 'tencent': {
        // https://y.qq.com/n/ryqq/playlist/12345.html
        const qqMatch = url.pathname.match(/\/playlist\/(\d+)/)
        if (qqMatch) return qqMatch[1]
        break
      }
      case 'kugou': {
        // Various kugou URL formats
        const kgMatch = url.pathname.match(/(\d+)/)
        if (kgMatch) return kgMatch[1]
        break
      }
    }
  } catch {
    // Not a URL, try to extract numbers
    const numMatch = trimmed.match(/(\d{4,})/)
    if (numMatch) return numMatch[1]
  }

  return null
}

export function usePlaylist() {
  const { socket } = useSocketContext()
  const [myPlaylists, setMyPlaylists] = useState<Record<MusicSource, Playlist[]>>({
    netease: [],
    tencent: [],
    kugou: [],
  })
  const [playlistsLoading, setPlaylistsLoading] = useState<Record<MusicSource, boolean>>({
    netease: false,
    tencent: false,
    kugou: false,
  })

  // Paginated playlist tracks state
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([])
  const [playlistTotal, setPlaylistTotal] = useState(0)
  const [hasMoreTracks, setHasMoreTracks] = useState(false)
  const [tracksLoading, setTracksLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // Track current playlist context to prevent stale responses
  const currentPlaylistRef = useRef<{ source: MusicSource; id: string } | null>(null)
  const offsetRef = useRef(0)
  const loadingMoreRef = useRef(false)

  useEffect(() => {
    const onMyList = (data: { platform: MusicSource; playlists: Playlist[] }) => {
      setMyPlaylists(prev => ({ ...prev, [data.platform]: data.playlists }))
      setPlaylistsLoading(prev => ({ ...prev, [data.platform]: false }))
    }

    socket.on(EVENTS.PLAYLIST_MY_LIST, onMyList)
    return () => {
      socket.off(EVENTS.PLAYLIST_MY_LIST, onMyList)
    }
  }, [socket])

  const fetchMyPlaylists = useCallback(
    (platform: MusicSource) => {
      setPlaylistsLoading(prev => ({ ...prev, [platform]: true }))
      socket.emit(EVENTS.PLAYLIST_GET_MY, { platform })
    },
    [socket],
  )

  /**
   * Fetch the first page of a playlist's tracks.
   * Resets all track state immediately to prevent stale data from flashing.
   */
  const fetchPlaylistTracks = useCallback(
    async (source: MusicSource, playlistId: string, trackCount?: number): Promise<Track[]> => {
      // Reset state immediately — prevents flashing old data when switching playlists
      setPlaylistTracks([])
      setPlaylistTotal(0)
      setHasMoreTracks(false)
      setTracksLoading(true)
      setLoadingMore(false)
      loadingMoreRef.current = false

      // Track current context for stale response detection
      currentPlaylistRef.current = { source, id: playlistId }
      offsetRef.current = 0

      try {
        const url = buildPlaylistUrl(source, playlistId, PAGE_SIZE, 0, {
          total: trackCount,
          roomId: useRoomStore.getState().room?.id,
          userId: storage.getUserId(),
        })
        const res = await fetch(url)
        if (!res.ok) {
          setTracksLoading(false)
          return []
        }

        // Stale response guard
        const ctx = currentPlaylistRef.current
        if (!ctx || ctx.source !== source || ctx.id !== playlistId) return []

        const data = await res.json()
        const tracks: Track[] = data.tracks ?? []
        const total: number = data.total ?? tracks.length

        setPlaylistTracks(tracks)
        setPlaylistTotal(total)
        setHasMoreTracks(data.hasMore ?? false)
        offsetRef.current = tracks.length
        setTracksLoading(false)
        return tracks
      } catch {
        // Only update state if this is still the active playlist
        const ctx = currentPlaylistRef.current
        if (ctx && ctx.source === source && ctx.id === playlistId) {
          setTracksLoading(false)
        }
        return []
      }
    },
    [],
  )

  /**
   * Load the next page of tracks for the current playlist.
   * Uses a ref for synchronous dedup — prevents duplicate requests from fast scrolling
   * even before React batches the state update.
   */
  const loadMoreTracks = useCallback(async () => {
    const ctx = currentPlaylistRef.current
    if (!ctx || loadingMoreRef.current || !hasMoreTracks) return

    loadingMoreRef.current = true
    setLoadingMore(true)

    try {
      const offset = offsetRef.current
      const url = buildPlaylistUrl(ctx.source, ctx.id, PAGE_SIZE, offset, {
        roomId: useRoomStore.getState().room?.id,
        userId: storage.getUserId(),
      })
      const res = await fetch(url)
      if (!res.ok) return

      // Stale response guard — context might have changed while we were fetching
      const currentCtx = currentPlaylistRef.current
      if (!currentCtx || currentCtx.source !== ctx.source || currentCtx.id !== ctx.id) return

      const data = await res.json()
      const newTracks: Track[] = data.tracks ?? []

      setPlaylistTracks(prev => [...prev, ...newTracks])
      setHasMoreTracks(data.hasMore ?? false)
      offsetRef.current = offset + newTracks.length
    } catch {
      // Silently fail — user can scroll again to retry
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [hasMoreTracks])

  const addTrackToQueue = useCallback(
    (track: Track) => {
      socket.emit(EVENTS.QUEUE_ADD, { track })
    },
    [socket],
  )

  const addBatchToQueue = useCallback(
    (tracks: Track[], playlistName?: string) => {
      socket.emit(EVENTS.QUEUE_ADD_BATCH, { tracks, playlistName })
    },
    [socket],
  )

  return {
    myPlaylists,
    playlistsLoading,
    playlistTracks,
    playlistTotal,
    hasMoreTracks,
    tracksLoading,
    loadingMore,
    fetchMyPlaylists,
    fetchPlaylistTracks,
    loadMoreTracks,
    addTrackToQueue,
    addBatchToQueue,
  }
}
