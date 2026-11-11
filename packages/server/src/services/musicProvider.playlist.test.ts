import { beforeEach, describe, expect, it, vi } from 'vitest'

const ncm = vi.hoisted(() => ({ album: vi.fn(), playlist_track_all: vi.fn() }))
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

describe('NetEase', () => {
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

describe('a size the caller claims, and a list that is cut short', () => {
  it('does not stop reading at the size the caller claims', async () => {
    const id = fresh()
    ncm.playlist_track_all
      .mockResolvedValueOnce({ body: { songs: neteaseSongs(1, 1000) } })
      .mockResolvedValueOnce({ body: { songs: neteaseSongs(1001, 500) } })
    // `total` arrives in the query string: a small claim must not shorten what is read, or what is remembered for everybody
    const page = await musicProvider.getPlaylistPage('netease', id, 10, 0, 5)
    expect(ncm.playlist_track_all).toHaveBeenCalledTimes(2)
    expect(page.total).toBe(1500)
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
    const first = await musicProvider.getPlaylistPage('netease', id, 10, 0)
    expect(first.total).toBe(1000)

    ncm.playlist_track_all
      .mockResolvedValueOnce({ body: { songs: neteaseSongs(1, 1000) } })
      .mockResolvedValueOnce({ body: { songs: neteaseSongs(1001, 500) } })
    const second = await musicProvider.getPlaylistPage('netease', id, 10, 0)
    expect(second.total).toBe(1500)
  })

  it('reads a Kugou list to the end when the API does not say how long it is', async () => {
    kugou.getPlaylistTracks
      .mockResolvedValueOnce({ songs: kugouSongs(1, 300), total: 0 })
      .mockResolvedValueOnce({ songs: kugouSongs(301, 20), total: 0 })
    const page = await musicProvider.getPlaylistPage('kugou', fresh(), 10, 0)
    expect(page.total).toBe(320)
  })

  it('does not remember a QQ list whose page failed half way', async () => {
    const id = fresh()
    tencent.getPlaylistTracks
      .mockResolvedValueOnce({ songs: tencentSongs(1, 100), total: 250 })
      .mockResolvedValueOnce({ songs: [], total: 0 }) // the native call answers a failure like this
    const first = await musicProvider.getPlaylistPage('tencent', id, 10, 0)
    expect(first.total).toBe(100)

    tencent.getPlaylistTracks
      .mockResolvedValueOnce({ songs: tencentSongs(1, 100), total: 250 })
      .mockResolvedValueOnce({ songs: tencentSongs(101, 100), total: 250 })
      .mockResolvedValueOnce({ songs: tencentSongs(201, 50), total: 250 })
    const second = await musicProvider.getPlaylistPage('tencent', id, 10, 0)
    expect(second.total).toBe(250)
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
