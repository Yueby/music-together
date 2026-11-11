// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoomState, Track } from '@music-together/shared'

const transport = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('@/lib/metadataFetch', () => ({ metadataFetch: transport.fetch }))
vi.mock('@/lib/config', () => ({ SERVER_URL: 'https://music.test' }))
vi.mock('@/providers/SocketProvider', () => ({
  useSocketContext: () => ({ socket: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } }),
}))

import { useRoomStore } from '@/stores/roomStore'
import { usePlaylist } from './usePlaylist'

const track = (id: string): Track => ({
  id: `t-${id}`,
  title: `Song ${id}`,
  artist: ['A'],
  album: 'B',
  duration: 100,
  cover: '',
  source: 'netease',
  sourceId: id,
  urlId: id,
})
const page = (ids: string[], extra: Record<string, unknown> = {}) =>
  ({
    ok: true,
    status: 200,
    json: async () => ({ tracks: ids.map(track), total: ids.length, hasMore: false, ...extra }),
  }) as Response
const failure = () => ({ ok: false, status: 503, json: async () => ({}) }) as Response
function deferred() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

let latest: ReturnType<typeof usePlaylist>
let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
function Probe() {
  const value = usePlaylist()
  useEffect(() => {
    latest = value
  })
  return null
}

beforeEach(() => {
  transport.fetch.mockReset()
  useRoomStore.setState({ room: { id: 'ROOM01' } as RoomState })
  container = document.createElement('div')
  root = createRoot(container)
  act(() => root.render(<Probe />))
})
afterEach(() => {
  act(() => root.unmount())
  useRoomStore.getState().reset()
})

describe('usePlaylist: reading a list', () => {
  it('reads a public list anonymously and an own list with the room, as the kind it is', async () => {
    transport.fetch.mockResolvedValue(page(['1']))
    await act(async () => void (await latest.fetchPlaylistTracks('netease', '9', 30, 'album')))
    expect(transport.fetch.mock.calls[0][0]).toContain('/api/music/playlist?')
    expect(transport.fetch.mock.calls[0][0]).toContain('type=album')
    await act(async () => void (await latest.fetchPlaylistTracks('netease', '9', 30, 'playlist', true)))
    expect(transport.fetch.mock.calls[1][0]).toContain('/api/music/playlist/mine?')
    expect(transport.fetch.mock.calls[1][0]).toContain('roomId=ROOM01')
    expect(latest.playlistTracks.map((t) => t.sourceId)).toEqual(['1'])
  })

  it('does not read an own list without a room', async () => {
    useRoomStore.getState().reset()
    await act(async () => void (await latest.fetchPlaylistTracks('netease', '9', 30, 'playlist', true)))
    expect(transport.fetch).not.toHaveBeenCalled()
    expect(latest.tracksLoading).toBe(false)
  })

  it('a failure of the list that was left does not end the loading of the one now opened', async () => {
    const first = deferred()
    const second = deferred()
    transport.fetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    let loadingFirst!: Promise<unknown>
    let loadingSecond!: Promise<unknown>
    await act(async () => {
      loadingFirst = latest.fetchPlaylistTracks('netease', 'A', 5)
      loadingSecond = latest.fetchPlaylistTracks('netease', 'B', 5)
    })
    // The old list's request fails after the new one started.
    first.resolve(failure())
    await act(async () => void (await loadingFirst))
    expect(latest.tracksLoading).toBe(true)
    second.resolve(page(['7']))
    await act(async () => void (await loadingSecond))
    expect(latest.tracksLoading).toBe(false)
    expect(latest.playlistTracks.map((t) => t.sourceId)).toEqual(['7'])
  })

  it('an album and a playlist with the same id are different lists', async () => {
    const playlist = deferred()
    transport.fetch.mockReturnValueOnce(playlist.promise).mockResolvedValueOnce(page(['album-song']))
    let loadingPlaylist!: Promise<unknown>
    await act(async () => {
      loadingPlaylist = latest.fetchPlaylistTracks('netease', '5', 3, 'playlist')
    })
    await act(async () => void (await latest.fetchPlaylistTracks('netease', '5', 3, 'album')))
    playlist.resolve(page(['playlist-song']))
    await act(async () => void (await loadingPlaylist))
    expect(latest.playlistTracks.map((t) => t.sourceId)).toEqual(['album-song'])
  })

  it('cancels the request of the list that was left', async () => {
    transport.fetch.mockReturnValue(new Promise(() => {}))
    await act(async () => {
      void latest.fetchPlaylistTracks('netease', 'A', 5)
      void latest.fetchPlaylistTracks('netease', 'B', 5)
    })
    const firstSignal = transport.fetch.mock.calls[0][1].signal as AbortSignal
    const secondSignal = transport.fetch.mock.calls[1][1].signal as AbortSignal
    expect(firstSignal.aborted).toBe(true)
    expect(secondSignal.aborted).toBe(false)
  })

  it('ignores the next page of a list that was left', async () => {
    transport.fetch.mockResolvedValueOnce(page(['1', '2'], { hasMore: true, total: 4 }))
    await act(async () => void (await latest.fetchPlaylistTracks('netease', 'A', 4)))
    const nextPage = deferred()
    transport.fetch.mockReturnValueOnce(nextPage.promise).mockResolvedValueOnce(page(['9']))
    let loadingMore!: Promise<unknown>
    await act(async () => {
      loadingMore = latest.loadMoreTracks()
    })
    await act(async () => void (await latest.fetchPlaylistTracks('netease', 'B', 1)))
    nextPage.resolve(page(['3', '4']))
    await act(async () => void (await loadingMore))
    expect(latest.playlistTracks.map((t) => t.sourceId)).toEqual(['9'])
  })
})
