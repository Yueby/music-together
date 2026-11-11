import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const meting = vi.hoisted(() => ({ search: vi.fn(), format: vi.fn() }))
vi.mock('@meting/core', () => ({
  default: class {
    format = meting.format
    search = meting.search
  },
}))

import { searchAlbums, searchPlaylists } from './catalogSearch.js'
import { SearchError } from './catalogUtils.js'

const QQ_KEY = 'music.search.SearchCgiService.DoSearchForQQMusicDesktop'
const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as Response

const qq = (body: unknown) => json({ [QQ_KEY]: { code: 0, data: { body } } })
const kugou = (info: unknown, errcode = 0) => json({ errcode, data: { info } })

const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  meting.search.mockReset()
  meting.format.mockReset()
})
afterEach(() => vi.unstubAllGlobals())

describe('QQ Music', () => {
  it('searches albums (type 2) and maps them, with https artwork and a thumbnail', async () => {
    fetchMock.mockResolvedValue(
      qq({
        album: {
          list: [
            {
              albumMID: 'm1',
              albumID: 1,
              albumName: 'Album',
              albumPic: 'http://y.gtimg.cn/music/photo_new/T002R300x300M000abc.jpg',
              song_count: 12,
              singerName: 'Singer',
            },
          ],
        },
      }),
    )
    const [first] = await searchAlbums('tencent', 'jj', 5, 2)
    expect(first).toEqual({
      id: 'm1',
      name: 'Album',
      cover: 'https://y.gtimg.cn/music/photo_new/T002R300x300M000abc.jpg',
      thumbnailCover: 'https://y.gtimg.cn/music/photo_new/T002R120x120M000abc.jpg',
      trackCount: 12,
      source: 'tencent',
      creator: 'Singer',
    })
    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string)[QQ_KEY].param
    expect(request).toMatchObject({ search_type: 2, query: 'jj', num_per_page: 5, page_num: 2 })
  })

  it('searches playlists (type 3) with their description', async () => {
    fetchMock.mockResolvedValue(
      qq({
        songlist: {
          list: [
            { dissid: 7, dissname: 'Mix', imgurl: '', song_count: 3, creator: { name: 'me' }, introduction: 'hi' },
          ],
        },
      }),
    )
    const [first] = await searchPlaylists('tencent', 'mix')
    expect(first).toMatchObject({
      id: '7',
      name: 'Mix',
      trackCount: 3,
      creator: 'me',
      description: 'hi',
      source: 'tencent',
    })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)[QQ_KEY].param.search_type).toBe(3)
  })

  it.each([
    ['an HTTP error', json({}, 500)],
    ['a business error', json({ [QQ_KEY]: { code: 2001 } })],
  ])('fails the search for %s, rather than answering "no results"', async (_name, response) => {
    fetchMock.mockResolvedValue(response)
    await expect(searchAlbums('tencent', 'x')).rejects.toBeInstanceOf(SearchError)
  })

  it('answers an empty list for an answer with no list', async () => {
    fetchMock.mockResolvedValue(qq({}))
    await expect(searchAlbums('tencent', 'x')).resolves.toEqual([])
  })
})

describe('Kugou', () => {
  it('searches albums and playlists through the matching endpoint, with the keyword escaped', async () => {
    fetchMock.mockResolvedValueOnce(
      kugou([
        { albumid: 5, albumname: 'A', imgurl: 'http://imge.kugou.com/{size}/a.jpg', songcount: 9, singername: 'S' },
      ]),
    )
    const [album] = await searchAlbums('kugou', '歌 手')
    expect(fetchMock.mock.calls[0][0]).toContain('/search/album?')
    expect(fetchMock.mock.calls[0][0]).toContain(`keyword=${encodeURIComponent('歌 手')}`)
    expect(album).toMatchObject({ id: '5', name: 'A', trackCount: 9, creator: 'S', source: 'kugou' })
    expect(album.cover).toContain('/5000/')
    expect(album.thumbnailCover).toContain('/120/')

    fetchMock.mockResolvedValueOnce(
      kugou([{ specialid: 8, specialname: 'P', imgurl: '', songcount: 2, nickname: 'N', intro: 'i' }]),
    )
    const [playlist] = await searchPlaylists('kugou', 'x')
    expect(fetchMock.mock.calls[1][0]).toContain('/search/special?')
    expect(playlist).toMatchObject({ id: '8', name: 'P', creator: 'N', description: 'i' })
  })

  it.each([
    ['an HTTP error', json({}, 502)],
    ['a refused search', kugou([], 1)],
    ['no info', json({ errcode: 0, data: {} })],
  ])('fails the search for %s, rather than answering "no results"', async (_name, response) => {
    fetchMock.mockResolvedValue(response)
    await expect(searchPlaylists('kugou', 'x')).rejects.toBeInstanceOf(SearchError)
  })

  it('answers an empty list when Kugou found nothing', async () => {
    fetchMock.mockResolvedValue(kugou([]))
    await expect(searchPlaylists('kugou', 'x')).resolves.toEqual([])
  })
})

describe('NetEase', () => {
  it('asks Meting for albums (10) and playlists (1000) unformatted, and maps https covers', async () => {
    meting.search.mockResolvedValueOnce(
      JSON.stringify({
        result: {
          albums: [
            { id: 1, name: 'A', picUrl: 'http://p1.music.126.net/a.jpg?param=130y130', size: 4, artist: { name: 'S' } },
          ],
        },
      }),
    )
    const [album] = await searchAlbums('netease', 'x', 10, 3)
    expect(meting.format).toHaveBeenCalledWith(false)
    expect(meting.search).toHaveBeenCalledWith('x', { limit: 10, page: 3, type: 10 })
    expect(album).toMatchObject({
      id: '1',
      cover: 'https://p1.music.126.net/a.jpg',
      thumbnailCover: 'https://p1.music.126.net/a.jpg?param=120y120',
      trackCount: 4,
      creator: 'S',
    })

    meting.search.mockResolvedValueOnce(
      JSON.stringify({
        result: {
          playlists: [
            { id: 2, name: 'P', coverImgUrl: '', trackCount: 6, creator: { nickname: 'N' }, description: 'd' },
          ],
        },
      }),
    )
    const [playlist] = await searchPlaylists('netease', 'x')
    expect(meting.search).toHaveBeenLastCalledWith('x', { limit: 20, page: 1, type: 1000 })
    expect(playlist).toMatchObject({ id: '2', name: 'P', trackCount: 6, creator: 'N', description: 'd' })
  })

  it.each([
    ['unparseable text', 'not json'],
    ['a timeout', null],
  ])('fails the search for %s, rather than answering "no results"', async (_name, raw) => {
    meting.search.mockResolvedValue(raw)
    await expect(searchAlbums('netease', 'x')).rejects.toBeInstanceOf(SearchError)
  })

  it('answers an empty list when NetEase leaves the list out because nothing matched', async () => {
    meting.search.mockResolvedValue(JSON.stringify({ result: { albumCount: 0 } }))
    await expect(searchAlbums('netease', 'x')).resolves.toEqual([])
  })
})

describe('any platform', () => {
  it.each(['netease', 'tencent', 'kugou'] as const)('does not search for an empty keyword on %s', async (source) => {
    await expect(searchAlbums(source, '  ')).resolves.toEqual([])
    await expect(searchPlaylists(source, '')).resolves.toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
    expect(meting.search).not.toHaveBeenCalled()
  })

  it('fails the search, with the same error whatever went wrong, when the upstream call throws', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    await expect(searchAlbums('tencent', 'x')).rejects.toBeInstanceOf(SearchError)
    await expect(searchPlaylists('kugou', 'x')).rejects.toMatchObject({ code: 'SEARCH_UPSTREAM', status: 503 })
  })
})
