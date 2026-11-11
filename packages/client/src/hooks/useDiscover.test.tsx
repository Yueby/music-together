// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Playlist, RoomState, Track } from '@music-together/shared'

const transport = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('@/lib/metadataFetch', () => ({ metadataFetch: transport.fetch }))
vi.mock('@/lib/config', () => ({ SERVER_URL: 'https://music.test' }))

import { useRoomStore } from '@/stores/roomStore'
import { useDiscover } from './useDiscover'

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
const list = (id: string): Playlist => ({ id, name: `Radar ${id}`, cover: '', trackCount: 30, source: 'netease' })
const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as Response
function deferred() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

let latest: ReturnType<typeof useDiscover>
let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
function Probe() {
  const value = useDiscover()
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

describe('useDiscover', () => {
  it("loads today's songs for the room the caller is in", async () => {
    transport.fetch.mockResolvedValueOnce(json({ items: [track('1'), track('2')] }))
    await act(async () => latest.loadDaily('netease'))
    expect(transport.fetch).toHaveBeenCalledWith(
      'https://music.test/api/music/discover/daily?source=netease&roomId=ROOM01',
      expect.objectContaining({ credentials: 'include' }),
    )
    expect(latest.daily).toMatchObject({ loading: false, error: null, source: 'netease' })
    expect(latest.daily.items.map((t) => t.sourceId)).toEqual(['1', '2'])
  })

  it('loads the radar list without a room', async () => {
    transport.fetch.mockResolvedValueOnce(json({ items: [list('1')] }))
    await act(async () => latest.loadRadar('netease'))
    expect(transport.fetch.mock.calls[0][0]).toBe('https://music.test/api/music/discover/radar?source=netease')
    expect(latest.radar.items).toHaveLength(1)
  })

  it.each([
    [401, 'login-required'],
    [400, 'unsupported'],
    [503, 'failed'],
  ] as const)('maps HTTP %i to %s and clears the list', async (status, expected) => {
    transport.fetch.mockResolvedValueOnce(json({ error: 'x' }, status))
    await act(async () => latest.loadDaily('tencent'))
    expect(latest.daily).toMatchObject({ error: expected, items: [], loading: false, source: 'tencent' })
  })

  it('treats a network failure as a retryable error', async () => {
    transport.fetch.mockRejectedValueOnce(new TypeError('offline'))
    await act(async () => latest.loadRadar('netease'))
    expect(latest.radar.error).toBe('failed')
  })

  it('does not request anything without a room and reports a failure instead of hanging', async () => {
    useRoomStore.getState().reset()
    await act(async () => latest.loadDaily('netease'))
    expect(transport.fetch).not.toHaveBeenCalled()
    expect(latest.daily).toMatchObject({ error: 'failed', loading: false })
  })

  it('loads the home blocks for the room the caller is in', async () => {
    transport.fetch.mockResolvedValueOnce(
      json({ playlists: [list('1')], artists: [], albums: [list('2')], failed: ['artists'] }),
    )
    await act(async () => latest.loadHome('netease'))
    expect(transport.fetch).toHaveBeenCalledWith(
      'https://music.test/api/music/discover/home?source=netease&roomId=ROOM01',
      expect.objectContaining({ credentials: 'include' }),
    )
    expect(latest.home).toMatchObject({ loading: false, error: null, source: 'netease' })
    expect(latest.home.data.playlists).toHaveLength(1)
    expect(latest.home.data.albums).toHaveLength(1)
    expect(latest.home.data.failed).toEqual(['artists'])
  })

  it('clears the home blocks and explains an unsupported platform', async () => {
    transport.fetch.mockResolvedValueOnce(json({ playlists: [list('1')], artists: [], albums: [] }))
    await act(async () => latest.loadHome('netease'))
    transport.fetch.mockResolvedValueOnce(json({ error: 'DISCOVER_UNSUPPORTED' }, 400))
    await act(async () => latest.loadHome('kugou'))
    expect(latest.home).toMatchObject({ error: 'unsupported', source: 'kugou' })
    expect(latest.home.data).toEqual({ playlists: [], artists: [], albums: [], failed: [] })
  })

  it('ignores a slow answer for a platform the user has already left', async () => {
    const slow = deferred()
    transport.fetch.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(json({ items: [track('9')] }))
    await act(async () => latest.loadDaily('netease'))
    expect(latest.daily).toMatchObject({ loading: true, source: 'netease' })
    await act(async () => latest.loadDaily('tencent'))
    slow.resolve(json({ items: [track('1')] }))
    await act(async () => {})
    expect(latest.daily.source).toBe('tencent')
    expect(latest.daily.items.map((t) => t.sourceId)).toEqual(['9'])
  })
})
