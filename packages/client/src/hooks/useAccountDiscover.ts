import { useDiscover, type DiscoverError } from '@/hooks/useDiscover'
import { DISCOVER_SOURCES } from '@music-together/shared'
import type { Artist, DiscoverHomeBlock, MusicSource, Playlist } from '@music-together/shared'
import { useEffect, useMemo } from 'react'

/** Id of the "today's recommendation" tile among the recommended playlists (no real playlist has it). */
export const DAILY_ID = 'daily'

interface BlockState {
  loading: boolean
  error: DiscoverError | null
}

/**
 * What the account page shows, ready to render: loads the discovery content for the platform (again when the login
 * changes), never lets a list loaded for another platform show, and turns each block's state into `loading` / `error`.
 * Today's recommendation is offered as a playlist-shaped `dailyTile`, the first of the recommended playlists.
 */
export function useAccountDiscover(platform: MusicSource, loggedIn: boolean, verifying: boolean) {
  const discover = useDiscover()
  const { loadHome, loadRadar, loadDaily } = discover
  const supported = DISCOVER_SOURCES.includes(platform)

  useEffect(() => {
    if (supported) loadRadar(platform)
  }, [supported, platform, loadRadar])

  // The recommended playlists are the account's own once signed in, and today's songs need the account at all: both wait
  // for the saved login to be confirmed instead of loading twice (and the songs are not asked for while signed out).
  useEffect(() => {
    if (!supported || verifying) return
    loadHome(platform)
    if (loggedIn) loadDaily(platform)
  }, [supported, verifying, loggedIn, platform, loadHome, loadDaily])

  const daily = useMemo(
    () => (verifying ? { ...discover.daily, loading: true, error: null } : discover.daily),
    [verifying, discover.daily],
  )

  const dailyTile = useMemo<Playlist | null>(() => {
    if (!supported || (!loggedIn && !verifying) || daily.error === 'login-required') return null
    if (!daily.loading && !daily.error && daily.items.length === 0) return null
    const first = daily.items[0]
    return {
      id: DAILY_ID,
      name: '每日推荐',
      cover: first?.cover ?? '',
      thumbnailCover: first?.thumbnailCover,
      trackCount: daily.items.length,
      source: platform,
      description: daily.loading
        ? '加载中…'
        : daily.error
          ? '加载失败，点击重试'
          : `${daily.items.length} 首 · 每天更新`,
    }
  }, [supported, loggedIn, verifying, daily, platform])

  // Never show what was loaded for another platform while this one is on its way.
  const home = discover.home.source === platform ? discover.home : null
  const radar = discover.radar.source === platform ? discover.radar : null

  const block = (name: DiscoverHomeBlock): BlockState => ({
    loading: home ? home.loading : true,
    // A block the server could not load is a failure of that block, not an empty one.
    error: home ? (home.error ?? (home.data.failed.includes(name) ? 'failed' : null)) : null,
  })

  return {
    supported,
    daily,
    dailyTile,
    playlists: { items: home?.data.playlists ?? [], ...block('playlists') },
    artists: { items: (home?.data.artists ?? []) as Artist[], ...block('artists') },
    albums: { items: home?.data.albums ?? [], ...block('albums') },
    radar: {
      items: radar?.items ?? [],
      loading: radar ? radar.loading : true,
      error: radar?.error ?? null,
    },
    reloadHome: () => loadHome(platform),
    reloadRadar: () => loadRadar(platform),
    reloadDaily: () => loadDaily(platform),
  }
}
