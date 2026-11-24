import type { MusicSource, Track } from '@music-together/shared'
import { isCancelledError, QueryClient, type QueryKey } from '@tanstack/react-query'

export const appQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 0, refetchOnWindowFocus: false, refetchOnReconnect: false, gcTime: 10 * 60_000 },
  },
})

export const queryKeys = {
  discover: {
    daily: (source: MusicSource, roomId: string) => ['discover', 'daily', source, roomId] as const,
    home: (source: MusicSource, roomId: string) => ['discover', 'home', source, roomId] as const,
    radar: (source: MusicSource) => ['discover', 'radar', source] as const,
  },
  artist: {
    home: (source: MusicSource, id: string) => ['artist', 'home', source, id] as const,
    songs: (source: MusicSource, id: string, offset: number, limit: number) =>
      ['artist', 'songs', source, id, offset, limit] as const,
    albums: (source: MusicSource, id: string, offset: number, limit: number) =>
      ['artist', 'albums', source, id, offset, limit] as const,
  },
  search: (source: MusicSource, type: string, keyword: string, page: number) =>
    ['search', source, type, keyword, page] as const,
  playlist: {
    public: (source: MusicSource, type: 'playlist' | 'album', id: string, offset: number, limit: number) =>
      ['playlist', 'public', source, type, id, offset, limit] as const,
    mine: (source: MusicSource, roomId: string, id: string, offset: number, limit: number) =>
      ['playlist', 'mine', source, roomId, id, offset, limit] as const,
  },
  lyric: (source: MusicSource, lyricId: string) => ['lyric', 'base', source, lyricId] as const,
  ttml: (track: Track) => ['lyric', 'ttml', track.source, track.id, track.title, track.sourceId] as const,
}

const accountLogins = new Map<string, boolean>()

export function clearAppQueryCache() {
  accountLogins.clear()
  appQueryClient.clear()
}

export function invalidateAccountQueries() {
  // Eviction also aborts in-flight reads started under the previous login.
  appQueryClient.removeQueries({ queryKey: ['discover', 'daily'] })
  appQueryClient.removeQueries({ queryKey: ['discover', 'home'] })
  appQueryClient.removeQueries({ queryKey: ['playlist', 'mine'] })
}

export function syncAccountLogin(source: MusicSource, roomId: string, loggedIn: boolean) {
  const key = JSON.stringify([source, roomId])
  const previous = accountLogins.get(key)
  accountLogins.set(key, loggedIn)
  if (previous !== undefined && previous !== loggedIn) invalidateAccountQueries()
}

const queryConsumers = new WeakMap<object, Set<() => void>>()

/** Each caller can leave independently. The query owns the transport and aborts when its last caller leaves. */
export function fetchAppQuery<T>(
  queryKey: QueryKey,
  staleTime: number,
  fetchData: (signal: AbortSignal) => Promise<T>,
  callerSignal: AbortSignal,
  options?: { force?: boolean; gcTime?: number },
): Promise<T> {
  const abortError = () => new DOMException('Query cancelled', 'AbortError')
  if (callerSignal.aborted) return Promise.reject(abortError())

  const cache = appQueryClient.getQueryCache()
  const filters = { queryKey, exact: true }
  const request = appQueryClient.fetchQuery({
    queryKey,
    staleTime: options?.force ? 0 : staleTime,
    ...(options?.gcTime === undefined ? {} : { gcTime: options.gcTime }),
    networkMode: 'always',
    queryFn: ({ signal }) => fetchData(signal),
  })
  const query = cache.find(filters)!
  const consumers = queryConsumers.get(query) ?? new Set<() => void>()
  queryConsumers.set(query, consumers)

  return new Promise<T>((resolve, reject) => {
    const release = () => {
      callerSignal.removeEventListener('abort', abandon)
      consumers.delete(abandon)
    }
    const abandon = () => {
      release()
      if (!consumers.size && cache.find(filters) === query) void appQueryClient.cancelQueries(filters)
      reject(abortError())
    }

    consumers.add(abandon)
    callerSignal.addEventListener('abort', abandon, { once: true })
    if (callerSignal.aborted) abandon()

    void request.then(
      (data) => {
        release()
        if (cache.find(filters) === query) resolve(data)
        else reject(abortError())
      },
      (error: unknown) => {
        release()
        reject(isCancelledError(error) ? abortError() : error)
      },
    )
  })
}
