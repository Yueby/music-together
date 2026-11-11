// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Artist, Playlist, Track } from '@music-together/shared'

const transport = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('@/lib/metadataFetch', () => ({ metadataFetch: transport.fetch }))
vi.mock('@/lib/config', () => ({ SERVER_URL: 'https://music.test' }))

import { useArtist } from './useArtist'

const track = (id: string): Track => ({
  id: `t-${id}`,
  title: `Song ${id}`,
  artist: ['JJ'],
  album: 'A',
  duration: 200,
  cover: '',
  source: 'netease',
  sourceId: id,
  urlId: id,
})
const album = (id: string): Playlist => ({ id, name: `Album ${id}`, cover: '', trackCount: 10, source: 'netease' })
const artist = (id: string): Artist => ({ id, name: `Artist ${id}`, cover: '', source: 'netease', songCount: 3 })

const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as Response

/** Resolves a pending request by hand so tests control completion order. */
function deferred() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

let latest: ReturnType<typeof useArtist>
let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

function Probe() {
  const value = useArtist()
  // Published after commit: reassigning outside state during render is not allowed.
  useEffect(() => {
    latest = value
  })
  return null
}

const flush = () => act(async () => {})

beforeEach(() => {
  transport.fetch.mockReset()
  container = document.createElement('div')
  root = createRoot(container)
  act(() => root.render(<Probe />))
})

afterEach(() => {
  act(() => root.unmount())
})

const home = (id: string, extra: Partial<{ songsMore: boolean; albumsMore: boolean }> = {}) =>
  json({
    artist: artist(id),
    songs: { items: [track('1'), track('2')], hasMore: extra.songsMore ?? true, total: 5 },
    albums: { items: [album('a1')], hasMore: extra.albumsMore ?? true },
  })

describe('useArtist', () => {
  it('loads the home page, requesting profile data from the artist endpoint', async () => {
    transport.fetch.mockResolvedValueOnce(home('3684'))
    await act(async () => {
      await latest.load('netease', '3684')
    })
    expect(transport.fetch).toHaveBeenCalledWith(
      'https://music.test/api/music/artist?source=netease&id=3684',
      expect.objectContaining({ credentials: 'include' }),
    )
    expect(latest.artist?.id).toBe('3684')
    expect(latest.songs.map((t) => t.sourceId)).toEqual(['1', '2'])
    expect(latest.songsTotal).toBe(5)
    expect(latest.songsHasMore).toBe(true)
    expect(latest.albums.map((a) => a.id)).toEqual(['a1'])
    expect(latest.loading).toBe(false)
    expect(latest.error).toBeNull()
  })

  describe('an artist known only by name', () => {
    const hits = (...found: Artist[]) => json({ tracks: found })

    it('finds who it is, then loads that artist like any other', async () => {
      transport.fetch.mockResolvedValueOnce(hits(artist('7')))
      transport.fetch.mockResolvedValueOnce(home('7'))
      await act(async () => {
        await latest.loadByName('netease', 'Artist 7')
      })
      expect(transport.fetch.mock.calls[0][0]).toContain('/api/music/search?')
      expect(transport.fetch.mock.calls[0][0]).toContain('type=artist')
      expect(transport.fetch.mock.calls[1][0]).toBe('https://music.test/api/music/artist?source=netease&id=7')
      expect(latest.artist?.id).toBe('7')
      expect(latest.songs).toHaveLength(2)
      expect(latest.error).toBeNull()
    })

    it('shows the name while it is looked up', async () => {
      const pending = deferred()
      transport.fetch.mockReturnValueOnce(pending.promise)
      let loading!: Promise<void>
      await act(async () => {
        loading = latest.loadByName('netease', 'Someone')
      })
      expect(latest.loading).toBe(true)
      expect(latest.artist?.name).toBe('Someone')
      pending.resolve(hits())
      await act(async () => {
        await loading
      })
    })

    it('says "not found" when nobody has that name, and "failed" when the lookup itself fails', async () => {
      transport.fetch.mockResolvedValueOnce(hits())
      await act(async () => {
        await latest.loadByName('netease', 'Nobody')
      })
      expect(latest.error).toBe('not-found')
      expect(latest.loading).toBe(false)

      transport.fetch.mockResolvedValueOnce(json({ error: 'x' }, 503))
      await act(async () => {
        await latest.loadByName('netease', 'Nobody')
      })
      expect(latest.error).toBe('failed')
      expect(latest.loading).toBe(false)
    })

    it('ignores a lookup that finishes after another artist was opened', async () => {
      const slow = deferred()
      transport.fetch.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(home('9'))
      let first!: Promise<void>
      await act(async () => {
        first = latest.loadByName('netease', 'Slow')
      })
      await act(async () => {
        await latest.load('netease', '9')
      })
      slow.resolve(hits(artist('1')))
      await act(async () => {
        await first
      })
      expect(latest.artist?.id).toBe('9')
      expect(transport.fetch).toHaveBeenCalledTimes(2)
    })
  })

  it('shows the search result as a placeholder while the profile loads', async () => {
    const pending = deferred()
    transport.fetch.mockReturnValueOnce(pending.promise)
    let loading!: Promise<void>
    await act(async () => {
      loading = latest.load('netease', '1', artist('1'))
    })
    expect(latest.loading).toBe(true)
    expect(latest.artist?.name).toBe('Artist 1')
    pending.resolve(home('1'))
    await act(async () => {
      await loading
    })
    expect(latest.loading).toBe(false)
  })

  it('pages songs from the number the server already returned and drops repeats', async () => {
    transport.fetch.mockResolvedValueOnce(home('1'))
    await act(async () => {
      await latest.load('netease', '1')
    })
    // The second page repeats song 2 (hot ranking shifted) and adds song 3.
    transport.fetch.mockResolvedValueOnce(json({ items: [track('2'), track('3')], hasMore: false }))
    await act(async () => {
      await latest.loadMoreSongs()
    })
    expect(transport.fetch).toHaveBeenLastCalledWith(
      'https://music.test/api/music/artist/songs?source=netease&id=1&offset=2&limit=50',
      expect.anything(),
    )
    expect(latest.songs.map((t) => t.sourceId)).toEqual(['1', '2', '3'])
    expect(latest.songsHasMore).toBe(false)

    // The last page was reached: scrolling further requests nothing.
    transport.fetch.mockClear()
    await act(async () => {
      await latest.loadMoreSongs()
    })
    expect(transport.fetch).not.toHaveBeenCalled()
  })

  it('pages albums and stops when a page comes back empty', async () => {
    transport.fetch.mockResolvedValueOnce(home('1'))
    await act(async () => {
      await latest.load('netease', '1')
    })
    transport.fetch.mockResolvedValueOnce(json({ items: [], hasMore: true }))
    await act(async () => {
      await latest.loadMoreAlbums()
    })
    expect(transport.fetch).toHaveBeenLastCalledWith(
      'https://music.test/api/music/artist/albums?source=netease&id=1&offset=1&limit=30',
      expect.anything(),
    )
    expect(latest.albumsHasMore).toBe(false)
  })

  it('does not request the same next page twice while one is in flight', async () => {
    transport.fetch.mockResolvedValueOnce(home('1'))
    await act(async () => {
      await latest.load('netease', '1')
    })
    const pending = deferred()
    transport.fetch.mockReturnValueOnce(pending.promise)
    await act(async () => {
      void latest.loadMoreSongs()
      void latest.loadMoreSongs()
    })
    expect(transport.fetch).toHaveBeenCalledTimes(2) // home + one page
    pending.resolve(json({ items: [track('9')], hasMore: false }))
    await flush()
    expect(latest.songs.map((t) => t.sourceId)).toEqual(['1', '2', '9'])
  })

  it('ignores a slow artist that finishes after a newer one was opened', async () => {
    const slow = deferred()
    transport.fetch.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(home('2'))
    let first!: Promise<void>
    await act(async () => {
      first = latest.load('netease', '1')
    })
    await act(async () => {
      await latest.load('netease', '2')
    })
    slow.resolve(home('1'))
    await act(async () => {
      await first
    })
    expect(latest.artist?.id).toBe('2')
  })

  it.each([
    [400, 'unsupported'],
    [404, 'not-found'],
    [502, 'failed'],
  ] as const)('maps HTTP %i to the %s state', async (status, expected) => {
    transport.fetch.mockResolvedValueOnce(json({ error: 'x' }, status))
    await act(async () => {
      await latest.load('netease', '1')
    })
    expect(latest.error).toBe(expected)
    expect(latest.loading).toBe(false)
  })

  it('treats a network failure as a retryable error', async () => {
    transport.fetch.mockRejectedValueOnce(new TypeError('offline'))
    await act(async () => {
      await latest.load('netease', '1')
    })
    expect(latest.error).toBe('failed')
  })

  it('clears everything on reset', async () => {
    transport.fetch.mockResolvedValueOnce(home('1'))
    await act(async () => {
      await latest.load('netease', '1')
    })
    act(() => latest.reset())
    expect(latest.artist).toBeNull()
    expect(latest.songs).toEqual([])
    expect(latest.albums).toEqual([])
    expect(latest.error).toBeNull()
  })
})
