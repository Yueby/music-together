// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Artist, MusicSource, Playlist, RoomState } from '@music-together/shared'

vi.mock('@/hooks/useArtworkUrl', () => ({ useArtworkUrl: (url?: string) => url }))

const hooks = vi.hoisted(() => ({
  loadHome: vi.fn(),
  loadRadar: vi.fn(),
  loadDaily: vi.fn(),
  fetchPlaylistTracks: vi.fn(),
  failedBlocks: [] as Array<'playlists' | 'artists' | 'albums'>,
  daily: { items: [], loading: false, error: null, source: 'netease' } as {
    items: Array<{ id: string; cover: string; thumbnailCover?: string }>
    loading: boolean
    error: 'login-required' | 'failed' | null
    source: string
  },
}))
const dailySongs = [
  { id: 'd1', cover: 'https://p1.music.126.net/d.jpg', thumbnailCover: 'https://p1.music.126.net/d.jpg?param=120y120' },
  { id: 'd2', cover: '' },
]

const radarList: Playlist = {
  id: '9',
  name: '私人雷达',
  cover: '',
  trackCount: 35,
  source: 'netease',
  creator: '云音乐',
}
const recommended: Playlist = {
  id: '11',
  name: '每日歌单',
  cover: '',
  trackCount: 40,
  source: 'netease',
  description: '根据你的口味',
}
const artist: Artist = { id: '31', name: '歌手甲', cover: '', source: 'netease', songCount: 40 }
const album: Playlist = { id: '41', name: '新专辑', cover: '', trackCount: 10, source: 'netease', creator: '歌手甲' }

vi.mock('@/hooks/useDiscover', () => ({
  useDiscover: () => ({
    daily: hooks.daily,
    radar: { items: [radarList], loading: false, error: null, source: 'netease' },
    home: {
      data: { playlists: [recommended], artists: [artist], albums: [album], failed: hooks.failedBlocks },
      loading: false,
      error: null,
      source: 'netease',
    },
    loadHome: hooks.loadHome,
    loadRadar: hooks.loadRadar,
    loadDaily: hooks.loadDaily,
  }),
}))
vi.mock('@/hooks/usePlaylist', () => ({
  usePlaylist: () => ({
    myPlaylists: { netease: [], tencent: [], kugou: [] },
    playlistsLoading: { netease: false, tencent: false, kugou: false },
    playlistTracks: [],
    tracksLoading: false,
    loadingMore: false,
    hasMoreTracks: false,
    playlistTotal: 0,
    fetchMyPlaylists: vi.fn(),
    fetchPlaylistTracks: hooks.fetchPlaylistTracks,
    loadMoreTracks: vi.fn(),
    addTrackToQueue: vi.fn(),
    insertTrackAfterCurrent: vi.fn(),
    addBatchToQueue: vi.fn(),
  }),
}))
vi.mock('./PlaylistDetail', () => ({
  PlaylistDetail: ({ playlist }: { playlist: Playlist | null }) => <div data-testid="detail">{playlist?.name}</div>,
}))
vi.mock('./PlaylistSection', () => ({ PlaylistSection: () => <div data-testid="my-playlists" /> }))

import { useArtistPageStore } from '@/stores/artistPageStore'
import { useRoomStore } from '@/stores/roomStore'
import type { AccountSession } from '@/hooks/useAccountSession'
import { PlatformHub } from './PlatformHub'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.clearAllMocks()
  hooks.daily = { items: dailySongs, loading: false, error: null, source: 'netease' }
  hooks.failedBlocks = []
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  useRoomStore.setState({ room: { id: 'ROOM01', queue: [] } as unknown as RoomState })
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  useRoomStore.getState().reset()
  useArtistPageStore.getState().close()
  vi.unstubAllGlobals()
})

const session = (platform: MusicSource, loggedIn: boolean, verifying = false) =>
  ({
    platform,
    loggedIn,
    verifying,
    myStatus: { platform, loggedIn },
    startQrLogin: vi.fn(),
    setCookieOpen: vi.fn(),
  }) as unknown as AccountSession

const render = (platform: MusicSource, loggedIn: boolean) =>
  act(() => root.render(<PlatformHub session={session(platform, loggedIn)} />))
const tile = (label: string) =>
  [...container.querySelectorAll('button')].find((button) => button.textContent?.includes(label))!

describe('PlatformHub', () => {
  it('is one page of blocks, not tabs', () => {
    render('netease', true)
    expect(container.querySelector('[role="tab"]')).toBeNull()
    for (const heading of ['推荐歌单', '私人雷达', '歌手推荐', '新碟上架']) {
      expect(container.textContent).toContain(heading)
    }
    expect(container.querySelector('[data-testid="my-playlists"]')).not.toBeNull()
  })

  it("lists today's recommendation as the first of the recommended playlists, not as a control of its own", () => {
    render('netease', true)
    const tiles = [...container.querySelectorAll('button')]
    const daily = tiles.findIndex((b) => b.textContent?.includes('每天更新'))
    expect(daily).toBeGreaterThanOrEqual(0)
    expect(tiles[daily].textContent).toContain('每日推荐')
    expect(tiles[daily].textContent).toContain('2 首 · 每天更新')
    expect(tiles[daily].querySelector('img')?.getAttribute('src')).toBe('https://p1.music.126.net/d.jpg?param=120y120')
    // Right before the other recommended playlists.
    expect(tiles[daily + 1].textContent).toContain('每日歌单')
  })

  it("opens today's songs like any playlist, without reading a playlist from the server", () => {
    render('netease', true)
    act(() => tile('每天更新').click())
    expect(container.querySelector('[data-testid="detail"]')?.textContent).toBe('每日推荐')
    expect(hooks.fetchPlaylistTracks).not.toHaveBeenCalled()
  })

  it('retries a failed day instead of opening an empty list', () => {
    hooks.daily = { items: [], loading: false, error: 'failed', source: 'netease' }
    render('netease', true)
    hooks.loadDaily.mockClear()
    act(() => tile('加载失败，点击重试').click())
    expect(hooks.loadDaily).toHaveBeenCalledExactlyOnceWith('netease')
    expect(container.querySelector('[data-testid="detail"]')).toBeNull()
  })

  it('has no daily tile while signed out (the sign-in banner explains it)', () => {
    hooks.daily = { items: [], loading: false, error: 'login-required', source: 'netease' }
    render('netease', false)
    expect(container.textContent).not.toContain('每天更新')
    expect(container.textContent).toContain('登录网易云音乐，查看每日推荐和自己的歌单')
  })

  it('offers one place to sign in, only while signed out', () => {
    render('netease', false)
    const signIn = () => [...container.querySelectorAll('button')].filter((b) => b.textContent === '扫码登录')
    expect(signIn()).toHaveLength(1)
    expect(container.textContent).toContain('登录网易云音乐，查看每日推荐和自己的歌单')
    render('netease', true)
    expect(signIn()).toHaveLength(0)
  })

  it('does not promise recommendations on a platform that has none', () => {
    render('tencent', false)
    expect(container.textContent).toContain('登录QQ 音乐，查看自己的歌单')
    expect(container.textContent).not.toContain('每日推荐和')
  })

  it("loads the blocks for the platform, today's songs only once signed in, and the page again when the login changes", () => {
    render('netease', false)
    expect(hooks.loadRadar).toHaveBeenCalledExactlyOnceWith('netease')
    expect(hooks.loadHome).toHaveBeenCalledExactlyOnceWith('netease')
    // Signed out: asking for the day's songs could only come back "401".
    expect(hooks.loadDaily).not.toHaveBeenCalled()
    render('netease', true)
    expect(hooks.loadHome).toHaveBeenCalledTimes(2)
    expect(hooks.loadDaily).toHaveBeenCalledExactlyOnceWith('netease')
    expect(hooks.loadRadar).toHaveBeenCalledTimes(1)
  })

  it('waits for a saved login to be confirmed instead of loading twice', () => {
    act(() => root.render(<PlatformHub session={session('netease', false, true)} />))
    expect(hooks.loadHome).not.toHaveBeenCalled()
    expect(hooks.loadDaily).not.toHaveBeenCalled()
    // Radar is the same for everyone, so it does not wait.
    expect(hooks.loadRadar).toHaveBeenCalledOnce()
    act(() => root.render(<PlatformHub session={session('netease', true, false)} />))
    expect(hooks.loadHome).toHaveBeenCalledOnce()
    expect(hooks.loadDaily).toHaveBeenCalledOnce()
  })

  it('reports a block the server could not load as failed, with a retry, not as empty', () => {
    hooks.failedBlocks = ['artists']
    render('netease', true)
    expect(container.textContent).toContain('歌手推荐加载失败')
    expect(container.textContent).not.toContain('暂无内容')
    hooks.loadHome.mockClear()
    act(() => tile('重试').click())
    expect(hooks.loadHome).toHaveBeenCalledExactlyOnceWith('netease')
    // The blocks that did load are still there.
    expect(container.textContent).toContain('新专辑')
  })

  it('says what the platform does not provide, once, and loads nothing for it', () => {
    render('tencent', true)
    expect(container.textContent).toContain('QQ 音乐暂不提供每日推荐、推荐歌单、私人雷达、歌手推荐和新碟上架')
    expect(container.querySelector('[data-testid="my-playlists"]')).not.toBeNull()
    expect(hooks.loadHome).not.toHaveBeenCalled()
    expect(hooks.loadRadar).not.toHaveBeenCalled()
    expect(hooks.loadDaily).not.toHaveBeenCalled()
  })

  it('opens a radar list with the account when signed in, anonymously otherwise', () => {
    render('netease', true)
    act(() => tile('35 首 · 云音乐').click())
    expect(hooks.fetchPlaylistTracks).toHaveBeenLastCalledWith('netease', '9', 35, 'playlist', true)
    expect(container.querySelector('[data-testid="detail"]')?.textContent).toBe('私人雷达')
  })

  it('opens a recommended playlist anonymously', () => {
    render('netease', true)
    act(() => tile('每日歌单').click())
    expect(hooks.fetchPlaylistTracks).toHaveBeenLastCalledWith('netease', '11', 40, 'playlist', false)
  })

  it('opens a new album as an album', () => {
    render('netease', true)
    act(() => tile('新专辑').click())
    expect(hooks.fetchPlaylistTracks).toHaveBeenLastCalledWith('netease', '41', 10, 'album', false)
    expect(container.querySelector('[data-testid="detail"]')?.textContent).toBe('新专辑')
  })

  it("opens the app's artist page for a recommended artist, on top of this page", () => {
    render('netease', true)
    act(() => tile('40 首歌曲').click())
    expect(useArtistPageStore.getState().target).toEqual({ source: 'netease', id: '31', name: '歌手甲' })
    // The account page itself stays where it was.
    expect(container.querySelector('[data-testid="my-playlists"]')).not.toBeNull()
  })

  it('leaves an open list when the platform changes', () => {
    render('netease', true)
    act(() => tile('每日歌单').click())
    expect(container.querySelector('[data-testid="detail"]')).not.toBeNull()
    render('tencent', true)
    expect(container.querySelector('[data-testid="detail"]')).toBeNull()
  })
})
