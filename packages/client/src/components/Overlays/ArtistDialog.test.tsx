// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Playlist } from '@music-together/shared'

const hooks = vi.hoisted(() => {
  // The room stores that `resetAllRoomState` reaches read the screen's media queries when they load.
  window.matchMedia ??= (query: string) =>
    ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList
  return { load: vi.fn(), loadByName: vi.fn(), fetchPlaylistTracks: vi.fn() }
})

vi.mock('@/components/ui/responsive-dialog', () => ({
  ResponsiveDialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
  ResponsiveDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResponsiveDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResponsiveDialogBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResponsiveDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  ResponsiveDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))
vi.mock('@/hooks/useArtist', () => ({
  useArtist: () => ({
    artist: null,
    loading: false,
    error: null,
    songs: [],
    songsTotal: 0,
    songsHasMore: false,
    songsLoadingMore: false,
    albums: [],
    albumsHasMore: false,
    albumsLoadingMore: false,
    load: hooks.load,
    loadByName: hooks.loadByName,
    loadMoreSongs: vi.fn(),
    loadMoreAlbums: vi.fn(),
  }),
}))
vi.mock('@/hooks/usePlaylist', () => ({
  usePlaylist: () => ({
    playlistTracks: [],
    tracksLoading: false,
    loadingMore: false,
    hasMoreTracks: false,
    playlistTotal: 0,
    fetchPlaylistTracks: hooks.fetchPlaylistTracks,
    loadMoreTracks: vi.fn(),
    addTrackToQueue: vi.fn(),
    insertTrackAfterCurrent: vi.fn(),
    addBatchToQueue: vi.fn(),
  }),
}))

const album: Playlist = { id: 'a1', name: 'Album', cover: '', trackCount: 10, source: 'netease' }
vi.mock('./ArtistDetail', () => ({
  ArtistDetail: ({
    onBack,
    onRetry,
    onSelectAlbum,
  }: {
    onBack: () => void
    onRetry: () => void
    onSelectAlbum: (album: Playlist) => void
  }) => (
    <div data-testid="artist-detail">
      <button onClick={onBack}>back</button>
      <button onClick={onRetry}>retry</button>
      <button onClick={() => onSelectAlbum(album)}>open-album</button>
    </div>
  ),
}))
vi.mock('./Settings/PlaylistDetail', () => ({
  PlaylistDetail: ({ playlist }: { playlist: Playlist | null }) => (
    <div data-testid="album-detail">{playlist?.name}</div>
  ),
}))

import { resetAllRoomState } from '@/lib/resetStores'
import { openArtistPage, useArtistPageStore } from '@/stores/artistPageStore'
import { ArtistDialog } from './ArtistDialog'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.clearAllMocks()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<ArtistDialog />))
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  useArtistPageStore.getState().close()
  vi.unstubAllGlobals()
})

const press = (label: string) =>
  act(() => [...container.querySelectorAll('button')].find((button) => button.textContent === label)!.click())

describe('ArtistDialog', () => {
  it('shows nothing, and loads nothing, until an artist is asked for', () => {
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(hooks.load).not.toHaveBeenCalled()
    expect(hooks.loadByName).not.toHaveBeenCalled()
  })

  it('opens an artist known by id directly, and one known only by name through the lookup', () => {
    act(() => openArtistPage({ source: 'netease', id: '3684', name: 'JJ' }))
    expect(container.querySelector('[data-testid="artist-detail"]')).not.toBeNull()
    expect(hooks.load).toHaveBeenCalledExactlyOnceWith('netease', '3684', expect.objectContaining({ name: 'JJ' }))
    expect(hooks.loadByName).not.toHaveBeenCalled()

    act(() => openArtistPage({ source: 'netease', name: 'Somebody' }))
    expect(hooks.loadByName).toHaveBeenCalledExactlyOnceWith('netease', 'Somebody')
  })

  it('starts over for another artist', () => {
    act(() => openArtistPage({ source: 'netease', id: '1', name: 'A' }))
    press('open-album')
    expect(container.querySelector('[data-testid="album-detail"]')).not.toBeNull()
    act(() => openArtistPage({ source: 'netease', id: '2', name: 'B' }))
    expect(container.querySelector('[data-testid="album-detail"]')).toBeNull()
    expect(hooks.load).toHaveBeenLastCalledWith('netease', '2', expect.anything())
    expect(hooks.load).toHaveBeenCalledTimes(2)
  })

  it('opens an album in place, reading it as an album, and the artist itself brings the songs back without a reload', () => {
    act(() => openArtistPage({ source: 'netease', id: '1', name: 'A' }))
    press('open-album')
    expect(hooks.fetchPlaylistTracks).toHaveBeenCalledExactlyOnceWith('netease', 'a1', 10, 'album')
    expect(container.querySelector('[data-testid="album-detail"]')?.textContent).toBe('Album')
    // A name tapped on a track inside the album: the same artist, asked for again.
    act(() => openArtistPage({ source: 'netease', id: '1', name: 'A' }))
    expect(container.querySelector('[data-testid="album-detail"]')).toBeNull()
    expect(container.querySelector('[data-testid="artist-detail"]')).not.toBeNull()
    expect(hooks.load).toHaveBeenCalledOnce()
  })

  it('retries a failed page the way it was opened, and closes from the back button', () => {
    act(() => openArtistPage({ source: 'netease', name: 'Somebody' }))
    press('retry')
    expect(hooks.loadByName).toHaveBeenCalledTimes(2)
    press('back')
    expect(useArtistPageStore.getState().target).toBeNull()
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('closes when the room is left, so it does not greet the next room', () => {
    act(() => openArtistPage({ source: 'netease', id: '1', name: 'A' }))
    act(() => resetAllRoomState())
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })
})
