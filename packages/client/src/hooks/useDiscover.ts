import { getMusicJson as getJson, statusOf } from '@/lib/musicApi'
import { useRoomStore } from '@/stores/roomStore'
import type { DiscoverHome, MusicSource, Playlist, Track } from '@music-together/shared'
import { useCallback, useEffect, useRef, useState } from 'react'

export type DiscoverError = 'login-required' | 'unsupported' | 'failed'

interface Section<T> {
  items: T[]
  loading: boolean
  error: DiscoverError | null
  /** Platform the items belong to, so a stale list is never shown under another platform. */
  source: MusicSource | null
}
const empty = <T>(): Section<T> => ({ items: [], loading: false, error: null, source: null })

/** The account page's discovery blocks, answered together by one request. */
interface HomeSection {
  data: DiscoverHome
  loading: boolean
  error: DiscoverError | null
  source: MusicSource | null
}
const noBlocks = (): DiscoverHome => ({ playlists: [], artists: [], albums: [], failed: [] })

function errorOf(status: number | undefined): DiscoverError {
  return status === 401 ? 'login-required' : status === 400 ? 'unsupported' : 'failed'
}

async function getItems<T>(path: string, params: Record<string, string>, signal: AbortSignal): Promise<T[]> {
  return (await getJson<{ items?: T[] }>(path, params, signal)).items ?? []
}

interface Run {
  generation: number
  abort: AbortController | null
}

/**
 * Personalised discovery: today's recommended songs (needs the caller's login), the radar playlists, and the home blocks
 * (recommended playlists, artists, new albums). Each has its own request generation, so a slow answer for a platform
 * the user has left never replaces a newer one.
 */
export function useDiscover() {
  const [daily, setDaily] = useState<Section<Track>>(empty)
  const [radar, setRadar] = useState<Section<Playlist>>(empty)
  const [home, setHome] = useState<HomeSection>({ data: noBlocks(), loading: false, error: null, source: null })
  const dailyRun = useRef<Run>({ generation: 0, abort: null })
  const radarRun = useRef<Run>({ generation: 0, abort: null })
  const homeRun = useRef<Run>({ generation: 0, abort: null })

  useEffect(() => {
    const runs = [dailyRun.current, radarRun.current, homeRun.current]
    return () => runs.forEach((run) => run.abort?.abort())
  }, [])

  /** Run `fetchData` as the newest request of `run`; `show` receives the loading, loaded and failed states. */
  const start = useCallback(
    <T>(
      run: Run,
      fetchData: (signal: AbortSignal) => Promise<T>,
      show: (state: { data: T | null; loading: boolean; error: DiscoverError | null }) => void,
    ) => {
      run.abort?.abort()
      const controller = new AbortController()
      run.abort = controller
      const generation = ++run.generation
      show({ data: null, loading: true, error: null })
      fetchData(controller.signal).then(
        (data) => {
          if (run.generation === generation) show({ data, loading: false, error: null })
        },
        (error: unknown) => {
          if (run.generation !== generation || (error instanceof DOMException && error.name === 'AbortError')) return
          show({ data: null, loading: false, error: errorOf(statusOf(error)) })
        },
      )
    },
    [],
  )

  const loadDaily = useCallback(
    (source: MusicSource) => {
      const roomId = useRoomStore.getState().room?.id
      if (!roomId) {
        dailyRun.current.abort?.abort()
        dailyRun.current.generation++
        setDaily({ items: [], loading: false, error: 'failed', source })
        return
      }
      start(
        dailyRun.current,
        (signal) => getItems<Track>('discover/daily', { source, roomId }, signal),
        (state) => setDaily({ items: state.data ?? [], loading: state.loading, error: state.error, source }),
      )
    },
    [start],
  )

  const loadRadar = useCallback(
    (source: MusicSource) =>
      start(
        radarRun.current,
        (signal) => getItems<Playlist>('discover/radar', { source }, signal),
        (state) => setRadar({ items: state.data ?? [], loading: state.loading, error: state.error, source }),
      ),
    [start],
  )

  const loadHome = useCallback(
    (source: MusicSource) => {
      const roomId = useRoomStore.getState().room?.id
      if (!roomId) {
        homeRun.current.abort?.abort()
        homeRun.current.generation++
        setHome({ data: noBlocks(), loading: false, error: 'failed', source })
        return
      }
      start(
        homeRun.current,
        (signal) => getJson<DiscoverHome>('discover/home', { source, roomId }, signal),
        (state) => setHome({ data: state.data ?? noBlocks(), loading: state.loading, error: state.error, source }),
      )
    },
    [start],
  )

  return { daily, radar, home, loadDaily, loadRadar, loadHome }
}
