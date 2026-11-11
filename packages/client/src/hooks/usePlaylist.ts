import { useCallback, useEffect, useRef, useState } from 'react'
import { EVENTS, MAPP_PLAYLIST_PAGE_MAX, type MusicSource, type Playlist, type Track } from '@music-together/shared'
import { useSocketContext } from '@/providers/SocketProvider'
import { useRoomStore } from '@/stores/roomStore'
import { SERVER_URL } from '@/lib/config'
import { hostRuntime } from '@/lib/hostRuntime'
import { metadataFetch } from '@/lib/metadataFetch'

/** Matches the most tracks a mini-app playlist page may carry, so every host pages the same way. */
const PAGE_SIZE = MAPP_PLAYLIST_PAGE_MAX

/**
 * Build the playlist API URL. Public lists and albums are anonymous (`/playlist`). The caller's own lists use
 * `/playlist/mine`, which also needs the room whose account pool holds the caller's music-platform login.
 */
function buildPlaylistUrl(
  source: MusicSource,
  id: string,
  limit: number,
  offset: number,
  options?: { total?: number; type?: 'playlist' | 'album'; personalRoomId?: string },
): string {
  const params = new URLSearchParams({
    source,
    id,
    limit: String(limit),
    offset: String(offset),
  })
  if (options?.total) params.set('total', String(options.total))
  if (options?.type) params.set('type', options.type)
  if (options?.personalRoomId) params.set('roomId', options.personalRoomId)
  const path = options?.personalRoomId ? 'playlist/mine' : 'playlist'
  return `${SERVER_URL}/api/music/${path}?${params.toString()}`
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

/** One request for a list: what is being read, and (for the caller's own lists) the room whose account reads it. */
interface PlaylistContext {
  source: MusicSource
  id: string
  type?: 'playlist' | 'album'
  personalRoomId?: string
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

  // The list being shown. Every `fetchPlaylistTracks` makes a new object, so "is this still the current list?" is an
  // identity check: it also tells apart an album and a playlist that share an id, or the same list read by another login.
  const currentPlaylistRef = useRef<PlaylistContext | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const offsetRef = useRef(0)
  const loadingMoreRef = useRef(false)

  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    if (!hostRuntime.platformAccounts) return
    const onMyList = (data: { platform: MusicSource; playlists: Playlist[] }) => {
      setMyPlaylists((prev) => ({ ...prev, [data.platform]: data.playlists }))
      setPlaylistsLoading((prev) => ({ ...prev, [data.platform]: false }))
    }

    socket.on(EVENTS.PLAYLIST_MY_LIST, onMyList)
    return () => {
      socket.off(EVENTS.PLAYLIST_MY_LIST, onMyList)
    }
  }, [socket])

  const fetchMyPlaylists = useCallback(
    (platform: MusicSource) => {
      if (!hostRuntime.platformAccounts) return
      setPlaylistsLoading((prev) => ({ ...prev, [platform]: true }))
      socket.emit(EVENTS.PLAYLIST_GET_MY, { platform })
    },
    [socket],
  )

  /**
   * Fetch the first page of a playlist's tracks.
   * Resets all track state immediately to prevent stale data from flashing.
   */
  const fetchPlaylistTracks = useCallback(
    async (
      source: MusicSource,
      playlistId: string,
      trackCount?: number,
      type: 'playlist' | 'album' = 'playlist',
      /** True for the caller's own lists (they may contain private tracks and need the caller's login). */
      personal = false,
    ): Promise<Track[]> => {
      const personalRoomId = personal ? useRoomStore.getState().room?.id : undefined
      // Reset state immediately — prevents flashing old data when switching playlists
      setPlaylistTracks([])
      setPlaylistTotal(0)
      setHasMoreTracks(false)
      setTracksLoading(true)
      setLoadingMore(false)
      loadingMoreRef.current = false

      // A newer list replaces whatever was still loading.
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const context: PlaylistContext = { source, id: playlistId, type, personalRoomId }
      currentPlaylistRef.current = context
      offsetRef.current = 0
      const isCurrent = () => currentPlaylistRef.current === context

      // Own lists need a room; without one there is nothing to read them with.
      if (personal && !personalRoomId) {
        setTracksLoading(false)
        return []
      }

      try {
        const url = buildPlaylistUrl(source, playlistId, PAGE_SIZE, 0, {
          total: trackCount,
          type,
          personalRoomId,
        })
        const res = await metadataFetch(url, { credentials: 'include', signal: controller.signal })
        // Whatever the answer, it only counts if this is still the list on screen: a late failure of an old list
        // must not end the loading state of the new one.
        if (!isCurrent()) return []
        if (!res.ok) {
          setTracksLoading(false)
          return []
        }

        const data = await res.json()
        if (!isCurrent()) return []
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
        if (isCurrent()) setTracksLoading(false)
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
        total: playlistTotal,
        type: ctx.type,
        personalRoomId: ctx.personalRoomId,
      })
      const res = await metadataFetch(url, { credentials: 'include', signal: abortRef.current?.signal })
      if (!res.ok) return

      // Stale response guard — the list might have changed while we were fetching
      if (currentPlaylistRef.current !== ctx) return

      const data = await res.json()
      if (currentPlaylistRef.current !== ctx) return
      const newTracks: Track[] = data.tracks ?? []

      setPlaylistTracks((prev) => [...prev, ...newTracks])
      setHasMoreTracks(data.hasMore ?? false)
      offsetRef.current = offset + newTracks.length
    } catch {
      // Silently fail — user can scroll again to retry
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [hasMoreTracks, playlistTotal])

  const addTrackToQueue = useCallback(
    (track: Track) => {
      socket.emit(EVENTS.QUEUE_ADD, { track })
    },
    [socket],
  )

  const insertTrackAfterCurrent = useCallback(
    (track: Track) => {
      socket.emit(EVENTS.QUEUE_INSERT_AFTER_CURRENT, { track })
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
    insertTrackAfterCurrent,
    addBatchToQueue,
  }
}
