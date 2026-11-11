import { beforeEach, describe, expect, it, vi } from 'vitest'

const meting = vi.hoisted(() => ({ song: vi.fn(), album: vi.fn(), playlist: vi.fn(), format: vi.fn() }))
vi.mock('@meting/core', () => ({
  default: class {
    format = meting.format
    song = meting.song
    album = meting.album
    playlist = meting.playlist
  },
}))

const provider = vi.hoisted(() => ({ ingest: vi.fn(), ingestNeteaseSongs: vi.fn() }))
vi.mock('./musicProvider.js', () => ({ musicProvider: provider }))

const artists = vi.hoisted(() => ({ getArtist: vi.fn() }))
vi.mock('./artistService.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./artistService.js')>()),
  artistService: artists,
}))
vi.mock('../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))

import { ArtistError } from './artistService.js'
import { SearchError } from './catalogUtils.js'
import { lookupById } from './idLookup.js'

const answer = (value: unknown) => JSON.stringify(value)

beforeEach(() => {
  for (const fn of [...Object.values(meting), ...Object.values(provider), ...Object.values(artists)]) fn.mockReset()
  provider.ingest.mockImplementation(async (tracks) => tracks)
  provider.ingestNeteaseSongs.mockImplementation((songs) =>
    Array.isArray(songs) ? songs.map((s) => ({ sourceId: String(s.id) })) : [],
  )
})

describe('songs', () => {
  it('reads a NetEase song through the shared registration of NetEase songs', async () => {
    meting.song.mockResolvedValue(answer({ songs: [{ id: 1901371647 }] }))
    await expect(lookupById('netease', 'song', '1901371647')).resolves.toEqual([{ sourceId: '1901371647' }])
    expect(meting.song).toHaveBeenCalledWith('1901371647')
    expect(meting.format).toHaveBeenCalledWith(false)
  })

  it('maps a QQ Music song and registers it', async () => {
    meting.song.mockResolvedValue(
      answer({
        data: [
          {
            mid: '003VHaBb0wCHop',
            name: 'Blank Space',
            interval: 231,
            singer: [{ name: 'Taylor Swift' }],
            album: { mid: 'abc', title: '1989' },
          },
        ],
      }),
    )
    const [track] = (await lookupById('tencent', 'song', '003VHaBb0wCHop')) as {
      sourceId: string
      title: string
      artist: string[]
      source: string
    }[]
    expect(track).toMatchObject({
      source: 'tencent',
      sourceId: '003VHaBb0wCHop',
      title: 'Blank Space',
      artist: ['Taylor Swift'],
    })
    expect(provider.ingest).toHaveBeenCalledOnce()
  })

  it('maps a Kugou song from its hash, with the template cover and without a length when Kugou gives none', async () => {
    meting.song.mockResolvedValue(
      answer({
        errcode: 0,
        hash: 'E12192D7B0A3E370BB2B5A4BCBB8F4C2',
        songName: '床边故事',
        author_name: '周杰伦、方文山',
        album_img: 'http://imge.kugou.com/stdmusic/{size}/a.jpg',
        timeLength: 0,
        privilege: 10,
      }),
    )
    const [track] = (await lookupById('kugou', 'song', 'E12192D7B0A3E370BB2B5A4BCBB8F4C2')) as Record<string, unknown>[]
    expect(track).toMatchObject({
      source: 'kugou',
      sourceId: 'E12192D7B0A3E370BB2B5A4BCBB8F4C2',
      urlId: 'E12192D7B0A3E370BB2B5A4BCBB8F4C2',
      title: '床边故事',
      artist: ['周杰伦', '方文山'],
      duration: 0,
      vip: true,
    })
    expect(String(track.cover)).not.toContain('{size}')
  })

  it.each([
    ['netease', { songs: [] }],
    ['tencent', { data: [] }],
    ['kugou', { errcode: 30001, error: 'data not found' }],
  ] as const)('finds nothing for an id that does not exist on %s', async (source, body) => {
    meting.song.mockResolvedValue(answer(body))
    await expect(lookupById(source, 'song', source === 'kugou' ? 'A'.repeat(32) : '123')).resolves.toEqual([])
  })
})

describe('albums and playlists', () => {
  it('describes a NetEase album and playlist from the platform answer', async () => {
    meting.album.mockResolvedValue(
      answer({
        album: { name: '海阔天空', picUrl: 'http://p2.music.126.net/x.jpg', size: 10, artist: { name: 'Beyond' } },
      }),
    )
    const [album] = await lookupById('netease', 'album', '34209')
    expect(album).toMatchObject({ id: '34209', name: '海阔天空', trackCount: 10, creator: 'Beyond', source: 'netease' })
    expect((album as { cover: string }).cover).toMatch(/^https:\/\//)

    meting.playlist.mockResolvedValue(
      answer({
        playlist: {
          name: '热歌榜',
          coverImgUrl: 'https://p1.music.126.net/y.jpg',
          trackCount: 200,
          creator: { nickname: '网易云音乐' },
          description: 'd',
        },
      }),
    )
    expect((await lookupById('netease', 'playlist', '3778678'))[0]).toMatchObject({
      id: '3778678',
      name: '热歌榜',
      trackCount: 200,
      creator: '网易云音乐',
      description: 'd',
    })
  })

  it('describes QQ Music albums and playlists, keeping the platform id as the id', async () => {
    meting.album.mockResolvedValue(
      answer({
        data: {
          getAlbumInfo: { Falbum_name: '叶惠美', Falbum_mid: '000MkMni19ClKG' },
          getSongInfo: [{ singer: [{ name: '周杰伦' }] }, {}],
        },
      }),
    )
    expect((await lookupById('tencent', 'album', '8220'))[0]).toMatchObject({
      id: '000MkMni19ClKG',
      name: '叶惠美',
      trackCount: 2,
      creator: '周杰伦',
    })

    meting.playlist.mockResolvedValue(
      answer({
        data: {
          cdlist: [
            {
              disstid: '7256912512',
              dissname: '欧美| 流行节奏控',
              songnum: 42,
              nickname: 'QQ音乐官方歌单',
              logo: 'http://q.test/c.jpg',
            },
          ],
        },
      }),
    )
    const [list] = await lookupById('tencent', 'playlist', '7256912512')
    expect(list).toMatchObject({ id: '7256912512', name: '欧美| 流行节奏控', trackCount: 42 })
    expect((list as { cover: string }).cover).toBe('https://q.test/c.jpg')
  })

  it('names a Kugou album or playlist by what it holds, since Kugou answers with songs only', async () => {
    const songs = {
      data: {
        total: 10,
        info: [
          {
            filename: '周杰伦 - 床边故事',
            remark: '',
            trans_param: { union_cover: 'http://imge.kugou.com/stdmusic/{size}/a.jpg' },
          },
        ],
      },
    }
    meting.album.mockResolvedValue(answer(songs))
    expect((await lookupById('kugou', 'album', '1645030'))[0]).toMatchObject({
      id: '1645030',
      name: '专辑 1645030',
      creator: '周杰伦',
      trackCount: 10,
    })
    meting.playlist.mockResolvedValue(answer(songs))
    expect((await lookupById('kugou', 'playlist', '545990'))[0]).toMatchObject({ name: '歌单 545990', trackCount: 10 })
  })

  it.each([
    ['netease', 'album', { album: null }],
    ['netease', 'playlist', { code: 404 }],
    ['tencent', 'album', { data: {} }],
    ['tencent', 'playlist', { data: { cdlist: [] } }],
    ['kugou', 'album', { data: { info: [] } }],
  ] as const)('finds nothing for a %s %s that does not exist', async (source, kind, body) => {
    meting[kind].mockResolvedValue(answer(body))
    await expect(lookupById(source, kind, '123')).resolves.toEqual([])
  })
})

describe('artists', () => {
  it('opens a NetEase artist as a one-item list', async () => {
    artists.getArtist.mockResolvedValue({ artist: { id: '11127', name: 'Beyond' }, songs: {}, albums: {} })
    await expect(lookupById('netease', 'artist', '11127')).resolves.toEqual([{ id: '11127', name: 'Beyond' }])
  })

  it('finds nothing for an unknown artist, and nothing at all on platforms without artist pages', async () => {
    artists.getArtist.mockRejectedValue(new ArtistError('ARTIST_NOT_FOUND', 404))
    await expect(lookupById('netease', 'artist', '1')).resolves.toEqual([])
    await expect(lookupById('tencent', 'artist', '003VHaBb0wCHop')).resolves.toEqual([])
    expect(artists.getArtist).toHaveBeenCalledTimes(1)
  })

  it('lets a platform failure through as the catalog failure it is', async () => {
    artists.getArtist.mockRejectedValue(new ArtistError('ARTIST_UPSTREAM', 503))
    await expect(lookupById('netease', 'artist', '1')).rejects.toMatchObject({ code: 'ARTIST_UPSTREAM' })
  })
})

describe('failures', () => {
  it('fails the search when the platform does not answer or throws, instead of saying "not found"', async () => {
    meting.song.mockRejectedValue(new Error('offline'))
    await expect(lookupById('netease', 'song', '1')).rejects.toBeInstanceOf(SearchError)
  })

  it('treats an answer that is not JSON as nothing found', async () => {
    meting.album.mockResolvedValue('<html>blocked</html>')
    await expect(lookupById('netease', 'album', '1')).resolves.toEqual([])
  })
})
