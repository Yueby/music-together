import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ncm = vi.hoisted(() => ({ album: vi.fn(), playlist_detail: vi.fn(), song_detail: vi.fn(), playlist_track_all: vi.fn() }))
const meting = vi.hoisted(() => ({ playlist: vi.fn(), album: vi.fn(), pic: vi.fn() }))
const kugou = vi.hoisted(() => ({ getPlaylistTracks: vi.fn() }))
const tencent = vi.hoisted(() => ({ getPlaylistTracks: vi.fn() }))

vi.mock('@neteasecloudmusicapienhanced/api', () => ({ default: ncm }))
vi.mock('@meting/core', () => ({
  default: class {
    playlist = meting.playlist
    album = meting.album
    pic = meting.pic
    format() {}
  },
}))
vi.mock('./kugouAuthService.js', () => kugou)
vi.mock('./tencentAuthService.js', () => tencent)
vi.mock('./neteasePlayback.js', () => ({ getNeteasePlaybackUrl: vi.fn() }))
vi.mock('../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))

import { musicProvider } from './musicProvider.js'
import { fetchKugouPlaylistTracks, fetchNeteasePlaylistTracks, fetchTencentPlaylistTracks } from './playlistFetchers.js'

/** Every test uses its own playlist id: the provider keeps its caches for the life of the process. */
let n = 0
const fresh = () => `playlist-${++n}`

const neteaseSongs = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: from + i,
    name: `Song ${from + i}`,
    ar: [{ id: 1, name: 'A' }],
    al: { name: 'Al' },
    dt: 1000,
  }))
const kugouSongs = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({ hash: `h${from + i}`, filename: `A - Song ${from + i}`, duration: 100 }))
const tencentSongs = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({ mid: `m${from + i}`, name: `Song ${from + i}`, singer: [{ name: 'A' }] }))
const ids = (tracks: { sourceId: string }[]) => tracks.map((t) => t.sourceId)

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

beforeEach(() => {
  for (const fn of [
    ...Object.values(ncm),
    ...Object.values(meting),
    ...Object.values(kugou),
    ...Object.values(tencent),
  ]) {
    fn.mockReset()
  }
  meting.pic.mockResolvedValue(JSON.stringify({ url: 'https://pic.test/c.jpg' }))
})
afterEach(() => vi.useRealTimers())

describe('NetEase', () => {
  it('emits the head before backfilling only missing IDs in ordered groups of three requests', async () => {
    const head = neteaseSongs(1, 100)
    const all = neteaseSongs(1, 2201)
    ncm.playlist_detail.mockResolvedValue({ body: { code: 200, playlist: { tracks: head, trackIds: all } } })
    const calls = new Map<number, ReturnType<typeof deferred<unknown>>>()
    ncm.song_detail.mockImplementation(({ ids: query }) => {
      const call = deferred<unknown>()
      calls.set(Number(query.split(',')[0]), call)
      return call.promise
    })
    const onBatch = vi.fn()
    const result = fetchNeteasePlaylistTracks(fresh(), 'MUSIC_U=me', onBatch)
    await vi.waitFor(() => expect(ncm.song_detail).toHaveBeenCalledTimes(3))
    expect(onBatch).toHaveBeenCalledExactlyOnceWith(expect.arrayContaining([expect.objectContaining({ sourceId: '1' })]), 2201)
    expect(ncm.playlist_detail).toHaveBeenCalledWith(expect.objectContaining({ cookie: 'MUSIC_U=me' }))
    expect([...calls.keys()]).toEqual([101, 601, 1101])
    expect(ncm.song_detail.mock.calls[0][0]).toMatchObject({
      ids: neteaseSongs(101, 500).map((song) => song.id).join(','), cookie: 'MUSIC_U=me',
    })
    const finish = (from: number, size: number) => calls.get(from)!.resolve({
      body: { code: 200, songs: neteaseSongs(from, size).reverse() },
    })
    finish(1101, 500)
    finish(601, 500)
    expect(ncm.song_detail).toHaveBeenCalledTimes(3)
    finish(101, 500)
    await vi.waitFor(() => expect(ncm.song_detail).toHaveBeenCalledTimes(5))
    finish(1601, 500)
    finish(2101, 101)
    await expect(result).resolves.toMatchObject({ complete: true })
    expect(onBatch.mock.calls.flatMap(([batch]) => ids(batch))).toEqual(all.map((song) => String(song.id)))
    expect(ncm.playlist_track_all).not.toHaveBeenCalled()
  })

  it('skips deleted NetEase trackIds omitted by song_detail without truncating the rest of the playlist', async () => {
    const head = neteaseSongs(1, 2)
    const all = neteaseSongs(1, 5)
    ncm.playlist_detail.mockResolvedValue({ body: { code: 200, playlist: { tracks: head, trackIds: all } } })
    // Song #4 was deleted upstream and omitted from song_detail, while #3 and #5 exist.
    ncm.song_detail.mockResolvedValue({ body: { code: 200, songs: [neteaseSongs(3, 1)[0], neteaseSongs(5, 1)[0]] } })

    const result = await fetchNeteasePlaylistTracks(fresh())
    expect(result.complete).toBe(true)
    expect(ids(result.tracks)).toEqual(['1', '2', '3', '5'])
  })

  it.each(['missing trackIds', 'failure', 'timeout'])('uses playlist_track_all when playlist_detail has %s', async (failure) => {
    vi.useFakeTimers()
    if (failure === 'timeout') ncm.playlist_detail.mockReturnValue(new Promise(() => {}))
    else if (failure === 'failure') ncm.playlist_detail.mockRejectedValue(new Error('offline'))
    else ncm.playlist_detail.mockResolvedValue({ body: { code: 200, playlist: { tracks: neteaseSongs(1, 1) } } })
    ncm.playlist_track_all.mockResolvedValue({ body: { code: 200, songs: neteaseSongs(2, 3) } })
    const onBatch = vi.fn()
    const result = fetchNeteasePlaylistTracks(fresh(), 'MUSIC_U=me', onBatch)
    await vi.advanceTimersByTimeAsync(5_000)
    await expect(result).resolves.toMatchObject({ complete: true })
    expect(onBatch).toHaveBeenCalledTimes(1)
    expect(ids(onBatch.mock.calls[0][0])).toEqual(['2', '3', '4'])
    expect(ncm.playlist_track_all).toHaveBeenCalledWith(expect.objectContaining({ offset: 0, cookie: 'MUSIC_U=me' }))
    expect(ncm.song_detail).not.toHaveBeenCalled()
  })

  it('reads a long playlist in chunks of 1000 and passes the caller cookie on', async () => {
    const id = fresh()
    ncm.playlist_track_all
      .mockResolvedValueOnce({ body: { songs: neteaseSongs(1, 1000) } })
      .mockResolvedValueOnce({ body: { songs: neteaseSongs(1001, 500) } })

    const page = await musicProvider.getPlaylistPage('netease', id, 3, 998, 1500, 'MUSIC_U=me')

    expect(ncm.playlist_track_all).toHaveBeenCalledTimes(2)
    expect(ncm.playlist_track_all.mock.calls.map(([q]) => q.offset)).toEqual([0, 1000])
    expect(ncm.playlist_track_all.mock.calls[0][0]).toMatchObject({ id, limit: 1000, cookie: 'MUSIC_U=me' })
    expect(ids(page.tracks)).toEqual(['999', '1000', '1001'])
    expect(page).toMatchObject({ total: 1500, hasMore: true })
  })

  it('stops after a short chunk instead of asking for more', async () => {
    ncm.playlist_track_all.mockResolvedValue({ body: { songs: neteaseSongs(1, 5) } })
    const page = await musicProvider.getPlaylistPage('netease', fresh(), 50, 0, 100000)
    expect(ncm.playlist_track_all).toHaveBeenCalledTimes(1)
    expect(page).toMatchObject({ total: 5, hasMore: false })
  })

  it('answers an empty page for an empty or unreachable playlist', async () => {
    ncm.playlist_track_all.mockResolvedValueOnce({ body: { code: 404 } })
    await expect(musicProvider.getPlaylistPage('netease', fresh(), 50, 0)).resolves.toEqual({
      tracks: [],
      total: 0,
      hasMore: false,
    })
    ncm.playlist_track_all.mockRejectedValueOnce(new Error('offline'))
    await expect(musicProvider.getPlaylistPage('netease', fresh(), 50, 0)).resolves.toMatchObject({ total: 0 })
  })

  it('reads an album from the album endpoint', async () => {
    const id = fresh()
    ncm.album.mockResolvedValue({ body: { songs: neteaseSongs(10, 3) } })
    const page = await musicProvider.getPlaylistPage('netease', id, 50, 0, undefined, null, 'album')
    expect(ncm.album).toHaveBeenCalledWith(expect.objectContaining({ id }))
    expect(ncm.playlist_track_all).not.toHaveBeenCalled()
    expect(ids(page.tracks)).toEqual(['10', '11', '12'])
  })

  it('serves the second page from what the first request read', async () => {
    const id = fresh()
    ncm.playlist_track_all.mockResolvedValue({ body: { songs: neteaseSongs(1, 30) } })
    const first = await musicProvider.getPlaylistPage('netease', id, 10, 0)
    const second = await musicProvider.getPlaylistPage('netease', id, 10, 10)
    expect(ncm.playlist_track_all).toHaveBeenCalledTimes(1)
    expect(ids(first.tracks)).toEqual(ids(neteaseSongs(1, 10).map((s) => ({ sourceId: String(s.id) }))))
    expect(ids(second.tracks)[0]).toBe('11')
    expect(first).toMatchObject({ total: 30, hasMore: true })
  })

  it('keeps a list read with one account apart from the public one and from other accounts', async () => {
    const id = fresh()
    ncm.playlist_track_all.mockResolvedValue({ body: { songs: neteaseSongs(1, 2) } })
    await musicProvider.getPlaylistPage('netease', id, 10, 0, undefined, 'MUSIC_U=a')
    await musicProvider.getPlaylistPage('netease', id, 10, 0, undefined, 'MUSIC_U=b')
    await musicProvider.getPlaylistPage('netease', id, 10, 0, undefined, null)
    await musicProvider.getPlaylistPage('netease', id, 10, 0, undefined, 'MUSIC_U=a')
    expect(ncm.playlist_track_all).toHaveBeenCalledTimes(3)
  })

  it('gives every returned track a fresh id and a cover', async () => {
    ncm.playlist_track_all.mockResolvedValue({
      body: { songs: [{ ...neteaseSongs(9001, 1)[0], al: { name: 'Al', pic: 5 } }] },
    })
    const id = fresh()
    const a = await musicProvider.getPlaylistPage('netease', id, 10, 0)
    const b = await musicProvider.getPlaylistPage('netease', id, 10, 0)
    expect(a.tracks[0].id).not.toBe(b.tracks[0].id)
    expect(a.tracks[0].cover).toBe('https://pic.test/c.jpg')
    expect(a.tracks[0].thumbnailCover).toBeTruthy()
  })
})

describe('Kugou', () => {
  it('returns at the 1200ms cover deadline and warms later artwork without mutating the response', async () => {
    vi.useFakeTimers()
    const id = fresh()
    const songs = kugouSongs(50_000, 20)
    kugou.getPlaylistTracks.mockResolvedValue({ songs, total: songs.length })
    await musicProvider.getCover('kugou', songs[19].hash)
    meting.pic.mockClear()
    const slow = deferred<string>()
    meting.pic.mockReturnValue(slow.promise)
    let settled = false
    const response = musicProvider.getPlaylistPage('kugou', id, 20, 0).then((page) => {
      settled = true
      return page
    })

    await vi.advanceTimersByTimeAsync(1_199)
    expect(settled).toBe(false)
    expect(meting.pic).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(1)
    expect(settled).toBe(true)
    const page = await response
    expect(page.tracks.slice(0, 19).every((track) => !track.cover)).toBe(true)
    expect(page.tracks[19].cover).toBe('https://pic.test/c.jpg')

    slow.resolve(JSON.stringify({ url: 'https://img.kugou.com/{size}/warm.jpg' }))
    await vi.advanceTimersByTimeAsync(0)
    expect(meting.pic).toHaveBeenCalledTimes(19)
    expect(page.tracks[0].cover).toBe('')
    const reread = await musicProvider.getPlaylistPage('kugou', id, 20, 0)
    expect(reread.tracks[18].cover).toBe('https://img.kugou.com/5000/warm.jpg')
    expect(kugou.getPlaylistTracks).toHaveBeenCalledTimes(1)
  })

  it('waits for at most 15 missing covers even when those covers resolve before the deadline', async () => {
    vi.useFakeTimers()
    const songs = kugouSongs(60_000, 20)
    kugou.getPlaylistTracks.mockResolvedValue({ songs, total: songs.length })
    const rest = deferred<string>()
    meting.pic.mockImplementation((hash) => Number(hash.slice(1)) < 60_015
      ? Promise.resolve(JSON.stringify({ url: 'https://img.kugou.com/{size}/visible.jpg' }))
      : rest.promise,
    )
    let settled = false
    const response = musicProvider.getPlaylistPage('kugou', fresh(), 20, 0).then((page) => {
      settled = true
      return page
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(settled).toBe(true)
    const { tracks } = await response
    expect(tracks.filter((track) => track.cover)).toHaveLength(15)
    rest.resolve('{}')
    await vi.advanceTimersByTimeAsync(0)
  })

  it('reads a playlist through the native API, page after page', async () => {
    const id = fresh()
    kugou.getPlaylistTracks
      .mockResolvedValueOnce({ songs: kugouSongs(1, 300), total: 350 })
      .mockResolvedValueOnce({ songs: kugouSongs(301, 50), total: 350 })
    const page = await musicProvider.getPlaylistPage('kugou', id, 5, 298, undefined, 'token=t;userid=1')
    expect(kugou.getPlaylistTracks.mock.calls.map((c) => [c[1], c[2]])).toEqual([
      [1, 300],
      [2, 300],
    ])
    expect(kugou.getPlaylistTracks.mock.calls[0][0]).toBe(id)
    expect(kugou.getPlaylistTracks.mock.calls[0][3]).toBe('token=t;userid=1')
    expect(ids(page.tracks)).toEqual(['h299', 'h300', 'h301', 'h302', 'h303'])
    expect(page.total).toBe(350)
    expect(meting.playlist).not.toHaveBeenCalled()
  })

  it('skips songs without a hash', async () => {
    kugou.getPlaylistTracks.mockResolvedValue({ songs: [...kugouSongs(1, 2), { filename: 'no hash' }], total: 3 })
    const page = await musicProvider.getPlaylistPage('kugou', fresh(), 10, 0)
    expect(ids(page.tracks)).toEqual(['h1', 'h2'])
  })

  it('falls back to Meting when the native API has nothing', async () => {
    const id = fresh()
    kugou.getPlaylistTracks.mockResolvedValue({ songs: [], total: 0 })
    meting.playlist.mockResolvedValue(
      JSON.stringify({ data: { info: kugouSongs(1, 2).map((s) => ({ ...s, hash: s.hash })) } }),
    )
    const page = await musicProvider.getPlaylistPage('kugou', id, 10, 0)
    expect(meting.playlist).toHaveBeenCalledWith(id)
    expect(ids(page.tracks)).toEqual(['h1', 'h2'])
  })

  it('reads an album through Meting, never the native playlist API', async () => {
    const id = fresh()
    meting.album.mockResolvedValue(JSON.stringify({ data: { info: kugouSongs(1, 2) } }))
    const page = await musicProvider.getPlaylistPage('kugou', id, 10, 0, undefined, null, 'album')
    expect(meting.album).toHaveBeenCalledWith(id)
    expect(kugou.getPlaylistTracks).not.toHaveBeenCalled()
    expect(ids(page.tracks)).toEqual(['h1', 'h2'])
  })

  it('answers an empty page when the native API throws and Meting has nothing', async () => {
    kugou.getPlaylistTracks.mockRejectedValue(new Error('offline'))
    meting.playlist.mockResolvedValue(JSON.stringify({ data: {} }))
    await expect(musicProvider.getPlaylistPage('kugou', fresh(), 10, 0)).resolves.toEqual({
      tracks: [],
      total: 0,
      hasMore: false,
    })
  })
})

describe('QQ Music', () => {
  it('reads a playlist through the native API, 100 per page', async () => {
    const id = fresh()
    tencent.getPlaylistTracks
      .mockResolvedValueOnce({ songs: tencentSongs(1, 100), total: 120 })
      .mockResolvedValueOnce({ songs: tencentSongs(101, 20), total: 120 })
    const page = await musicProvider.getPlaylistPage('tencent', id, 3, 99, undefined, 'qm_keyst=k')
    expect(tencent.getPlaylistTracks.mock.calls.map((c) => [c[1], c[2]])).toEqual([
      [1, 100],
      [2, 100],
    ])
    expect(tencent.getPlaylistTracks.mock.calls[0][3]).toBe('qm_keyst=k')
    expect(ids(page.tracks)).toEqual(['m100', 'm101', 'm102'])
    expect(page).toMatchObject({ total: 120, hasMore: true })
  })

  it('falls back to Meting (data.cdlist.0.songlist) when the native API has nothing', async () => {
    tencent.getPlaylistTracks.mockResolvedValue({ songs: [], total: 0 })
    meting.playlist.mockResolvedValue(JSON.stringify({ data: { cdlist: [{ songlist: tencentSongs(1, 2) }] } }))
    const page = await musicProvider.getPlaylistPage('tencent', fresh(), 10, 0)
    expect(ids(page.tracks)).toEqual(['m1', 'm2'])
  })

  it('reads an album through Meting (data.getSongInfo)', async () => {
    meting.album.mockResolvedValue(JSON.stringify({ data: { getSongInfo: tencentSongs(1, 2) } }))
    const page = await musicProvider.getPlaylistPage('tencent', fresh(), 10, 0, undefined, null, 'album')
    expect(tencent.getPlaylistTracks).not.toHaveBeenCalled()
    expect(ids(page.tracks)).toEqual(['m1', 'm2'])
  })
})

describe.each([
  { name: 'Kugou', api: kugou, fetchTracks: fetchKugouPlaylistTracks, songs: kugouSongs, pageSize: 300 },
  { name: 'Tencent', api: tencent, fetchTracks: fetchTencentPlaylistTracks, songs: tencentSongs, pageSize: 100 },
])('$name native batching', ({ api, fetchTracks, songs, pageSize }) => {
  it('emits the head and reads at most three tail pages at a time in playlist order', async () => {
    const total = pageSize * 6 + 10
    const pending = new Map<number, ReturnType<typeof deferred<unknown>>>()
    api.getPlaylistTracks.mockImplementation((_id, page) => {
      if (page === 1) return Promise.resolve({ songs: songs(1, pageSize), total })
      const response = deferred<unknown>()
      pending.set(page, response)
      return response.promise
    })
    const onBatch = vi.fn()
    const result = fetchTracks(fresh(), null, onBatch)
    const finish = (page: number, size = pageSize) => pending.get(page)!.resolve({
      songs: songs((page - 1) * pageSize + 1, size), total,
    })
    await vi.waitFor(() => expect([...pending.keys()]).toEqual([2, 3, 4]))
    expect(onBatch).toHaveBeenCalledTimes(1)
    expect(onBatch.mock.calls[0][1]).toBe(total)
    finish(4)
    finish(3)
    expect(api.getPlaylistTracks).toHaveBeenCalledTimes(4)
    finish(2)
    await vi.waitFor(() => expect([...pending.keys()]).toEqual([2, 3, 4, 5, 6, 7]))
    finish(7, 10)
    finish(6)
    finish(5)
    const { tracks, complete } = await result
    expect(complete).toBe(true)
    expect(onBatch.mock.calls.map(([batch]) => batch[0].title)).toEqual(
      Array.from({ length: 7 }, (_, i) => `Song ${i * pageSize + 1}`),
    )
    expect(tracks).toHaveLength(total)
  })

  it('keeps only the contiguous prefix when a page is short before the announced total', async () => {
    const total = pageSize * 4
    api.getPlaylistTracks.mockImplementation(async (_id, page) => ({
      songs: songs((page - 1) * pageSize + 1, page === 2 ? 10 : pageSize), total,
    }))
    const onBatch = vi.fn()
    const { tracks, complete } = await fetchTracks(fresh(), null, onBatch)
    expect(complete).toBe(false)
    expect(tracks).toHaveLength(pageSize + 10)
    expect(onBatch).toHaveBeenCalledTimes(2)
  })
})

describe('a size the caller claims, and a list that is cut short', () => {
  it('does not stop reading at the size the caller claims', async () => {
    const id = fresh()
    ncm.playlist_track_all
      .mockResolvedValueOnce({ body: { songs: neteaseSongs(1, 1000) } })
      .mockResolvedValueOnce({ body: { songs: neteaseSongs(1001, 500) } })
    // `total` arrives in the query string: a small claim must not shorten what is read, or what is remembered for everybody
    const page = await musicProvider.getPlaylistPage('netease', id, 10, 0, 5)
    expect(ncm.playlist_track_all).toHaveBeenCalledTimes(2)
    expect(page.total).toBe(1000)
    await expect(musicProvider.fetchFullPlaylist('netease', id)).resolves.toMatchObject({ total: 1500 })
    const again = await musicProvider.getPlaylistPage('netease', id, 10, 0)
    expect(again.total).toBe(1500)
  })

  it('reads on after a full last chunk, to find the list has ended', async () => {
    ncm.playlist_track_all
      .mockResolvedValueOnce({ body: { songs: neteaseSongs(1, 1000) } })
      .mockResolvedValueOnce({ body: { songs: [] } })
    const page = await musicProvider.getPlaylistPage('netease', fresh(), 10, 0)
    expect(page.total).toBe(1000)
    expect(ncm.playlist_track_all).toHaveBeenCalledTimes(2)
  })

  it('shows what was read of a list that timed out, but reads it again next time', async () => {
    const id = fresh()
    ncm.playlist_track_all
      .mockResolvedValueOnce({ body: { songs: neteaseSongs(1, 1000) } })
      .mockRejectedValueOnce(new Error('offline'))
    const first = await musicProvider.getPlaylistPage('netease', id, 10, 995)
    expect(first.total).toBe(1000)

    ncm.playlist_track_all
      .mockResolvedValueOnce({ body: { songs: neteaseSongs(1, 1000) } })
      .mockResolvedValueOnce({ body: { songs: neteaseSongs(1001, 500) } })
    const second = await musicProvider.getPlaylistPage('netease', id, 10, 995)
    expect(second.total).toBe(1500)
  })

  it('reads a Kugou list to the end when the API does not say how long it is', async () => {
    kugou.getPlaylistTracks
      .mockResolvedValueOnce({ songs: kugouSongs(1, 300), total: 0 })
      .mockResolvedValueOnce({ songs: kugouSongs(301, 20), total: 0 })
    const id = fresh()
    const page = await musicProvider.getPlaylistPage('kugou', id, 10, 0)
    expect(page.total).toBe(300)
    await expect(musicProvider.fetchFullPlaylist('kugou', id)).resolves.toMatchObject({ total: 320 })
  })

  it('does not remember a QQ list whose page failed half way', async () => {
    const id = fresh()
    tencent.getPlaylistTracks
      .mockResolvedValueOnce({ songs: tencentSongs(1, 100), total: 250 })
      .mockResolvedValueOnce({ songs: [], total: 0 }) // the native call answers a failure like this
    const first = await musicProvider.getPlaylistPage('tencent', id, 10, 95)
    expect(first).toMatchObject({ total: 250, hasMore: true })
    expect(first.tracks).toHaveLength(5)

    tencent.getPlaylistTracks
      .mockResolvedValueOnce({ songs: tencentSongs(1, 100), total: 250 })
      .mockResolvedValueOnce({ songs: tencentSongs(101, 100), total: 250 })
      .mockResolvedValueOnce({ songs: tencentSongs(201, 50), total: 250 })
    const second = await musicProvider.getPlaylistPage('tencent', id, 10, 95)
    expect(second.total).toBe(250)
    expect(second.tracks).toHaveLength(10)
  })

  it('leaves out QQ songs without a mid instead of listing them as "undefined"', async () => {
    tencent.getPlaylistTracks.mockResolvedValue({
      songs: [...tencentSongs(1, 2), { name: 'no mid', singer: [{ name: 'A' }] }],
      total: 3,
    })
    const page = await musicProvider.getPlaylistPage('tencent', fresh(), 10, 0)
    expect(ids(page.tracks)).toEqual(['m1', 'm2'])
  })

  it('remembers a list that was read to its end', async () => {
    const id = fresh()
    tencent.getPlaylistTracks.mockResolvedValue({ songs: tencentSongs(1, 30), total: 30 })
    await musicProvider.getPlaylistPage('tencent', id, 10, 0)
    await musicProvider.getPlaylistPage('tencent', id, 10, 10)
    expect(tencent.getPlaylistTracks).toHaveBeenCalledTimes(1)
  })
})

describe('Meting answers it cannot use', () => {
  it.each([
    ['unparseable text', 'not json'],
    ['a timeout', null],
    ['no song list', JSON.stringify({ data: {} })],
  ])('gives an empty page for %s', async (_name, raw) => {
    tencent.getPlaylistTracks.mockResolvedValue({ songs: [], total: 0 })
    meting.playlist.mockResolvedValue(raw)
    await expect(musicProvider.getPlaylistPage('tencent', fresh(), 10, 0)).resolves.toEqual({
      tracks: [],
      total: 0,
      hasMore: false,
    })
  })
})
