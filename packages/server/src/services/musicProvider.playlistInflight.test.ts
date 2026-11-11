import type { Track } from '@music-together/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchers = vi.hoisted(() => ({ fetchPlaylistTracks: vi.fn() }))
vi.mock('./playlistFetchers.js', () => fetchers)
vi.mock('./neteasePlayback.js', () => ({ getNeteasePlaybackUrl: vi.fn() }))
vi.mock('../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))

import { musicProvider } from './musicProvider.js'

/** Every test uses its own playlist id: the provider keeps its caches for the life of the process. */
let n = 0
const fresh = () => `inflight-${++n}`

const track = (sourceId: string): Track => ({
  id: `local-${sourceId}`,
  title: `Song ${sourceId}`,
  artist: ['A'],
  album: '',
  duration: 100,
  cover: 'https://pic.test/c.jpg',
  source: 'netease',
  sourceId,
  urlId: sourceId,
})

/** What a fetcher answers for a list that was read to its end. */
const whole = (...tracks: Track[]) => ({ tracks, complete: true })
type Fetched = ReturnType<typeof whole>

/** A fetch the test settles by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  fetchers.fetchPlaylistTracks.mockReset()
})

describe('fetchFullPlaylist in-flight sharing', () => {
  it('shares one read between concurrent callers of the same list and account', async () => {
    const id = fresh()
    const read = deferred<Fetched>()
    fetchers.fetchPlaylistTracks.mockReturnValue(read.promise)

    const a = musicProvider.fetchFullPlaylist('netease', id, 'MUSIC_U=a')
    const b = musicProvider.fetchFullPlaylist('netease', id, 'MUSIC_U=a')
    read.resolve(whole(track('1'), track('2'), track('3')))

    await expect(a).resolves.toEqual({ ids: ['1', '2', '3'], total: 3 })
    await expect(b).resolves.toEqual({ ids: ['1', '2', '3'], total: 3 })
    expect(fetchers.fetchPlaylistTracks).toHaveBeenCalledTimes(1)

    // Afterwards the finished list is served from the index, still without another read.
    await musicProvider.fetchFullPlaylist('netease', id, 'MUSIC_U=a')
    expect(fetchers.fetchPlaylistTracks).toHaveBeenCalledTimes(1)
  })

  it('never shares a read between different accounts, the public list, or an album and a playlist', async () => {
    const id = fresh()
    fetchers.fetchPlaylistTracks.mockImplementation(async () => whole(track('1')))

    await Promise.all([
      musicProvider.fetchFullPlaylist('netease', id, 'MUSIC_U=a'),
      musicProvider.fetchFullPlaylist('netease', id, 'MUSIC_U=b'),
      musicProvider.fetchFullPlaylist('netease', id, null),
      musicProvider.fetchFullPlaylist('netease', id, null, 'album'),
    ])
    expect(fetchers.fetchPlaylistTracks).toHaveBeenCalledTimes(4)
  })

  it('lets every waiter see a failure, then frees the key so the next call reads again', async () => {
    const id = fresh()
    const read = deferred<Fetched>()
    fetchers.fetchPlaylistTracks.mockReturnValueOnce(read.promise)

    const a = musicProvider.fetchFullPlaylist('netease', id)
    const b = musicProvider.fetchFullPlaylist('netease', id)
    read.reject(new Error('upstream down'))
    await expect(a).rejects.toThrow('upstream down')
    await expect(b).rejects.toThrow('upstream down')
    expect(fetchers.fetchPlaylistTracks).toHaveBeenCalledTimes(1)

    fetchers.fetchPlaylistTracks.mockResolvedValueOnce(whole(track('7')))
    await expect(musicProvider.fetchFullPlaylist('netease', id)).resolves.toEqual({ ids: ['7'], total: 1 })
    expect(fetchers.fetchPlaylistTracks).toHaveBeenCalledTimes(2)
  })

  it('does not hold the key after an empty answer either', async () => {
    const id = fresh()
    fetchers.fetchPlaylistTracks.mockResolvedValueOnce(whole())
    await expect(musicProvider.fetchFullPlaylist('netease', id)).resolves.toEqual({ ids: [], total: 0 })
    fetchers.fetchPlaylistTracks.mockResolvedValueOnce(whole(track('8')))
    await expect(musicProvider.fetchFullPlaylist('netease', id)).resolves.toEqual({ ids: ['8'], total: 1 })
  })

  it('serves concurrent pages of the same list from one read', async () => {
    const id = fresh()
    const read = deferred<Fetched>()
    fetchers.fetchPlaylistTracks.mockReturnValue(read.promise)

    const first = musicProvider.getPlaylistPage('netease', id, 2, 0)
    const second = musicProvider.getPlaylistPage('netease', id, 2, 2)
    read.resolve(whole(track('1'), track('2'), track('3'), track('4')))

    expect((await first).tracks.map((t) => t.sourceId)).toEqual(['1', '2'])
    expect((await second).tracks.map((t) => t.sourceId)).toEqual(['3', '4'])
    expect(fetchers.fetchPlaylistTracks).toHaveBeenCalledTimes(1)
  })
})
