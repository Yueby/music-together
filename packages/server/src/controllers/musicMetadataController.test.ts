import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getDailyMetadata,
  getMusicLyricMetadata,
  getMyPlaylistPageMetadata,
  getRadarMetadata,
  getPlaylistPageMetadata,
  PlaylistAccessError,
  searchMusicMetadata,
} from './musicMetadataController.js'

const provider = vi.hoisted(() => ({
  search: vi.fn(),
  searchAlbum: vi.fn(),
  searchPlaylist: vi.fn(),
  getLyric: vi.fn(),
  getPlaylistPage: vi.fn(),
}))
const discover = vi.hoisted(() => ({ getDaily: vi.fn(), getRadar: vi.fn() }))
vi.mock('../services/discoverService.js', () => ({ discoverService: discover }))
const lookup = vi.hoisted(() => ({ lookupById: vi.fn() }))
vi.mock('../services/idLookup.js', () => lookup)
const rooms = vi.hoisted(() => ({ get: vi.fn() }))
const accounts = vi.hoisted(() => ({ getUserCookie: vi.fn() }))
vi.mock('../services/musicProvider.js', () => ({ musicProvider: provider }))
vi.mock('../repositories/roomRepository.js', () => ({ roomRepo: rooms }))
vi.mock('../services/authService.js', () => accounts)
beforeEach(() => vi.resetAllMocks())

describe('a keyword that is an id or a share link', () => {
  const base = { limit: 20, page: 1 } as const

  it.each([
    ['song', 'song'],
    ['album', 'album'],
    ['playlist', 'playlist'],
    ['artist', 'artist'],
  ] as const)('looks the %s up directly and does not search for the words', async (type, kind) => {
    lookup.lookupById.mockResolvedValue([{ id: 'found' }])
    await expect(searchMusicMetadata({ ...base, source: 'netease', keyword: ' 3778678 ', type })).resolves.toEqual({
      tracks: [{ id: 'found' }],
      page: 1,
      hasMore: false,
    })
    expect(lookup.lookupById).toHaveBeenCalledExactlyOnceWith('netease', kind, '3778678')
    expect(provider.search).not.toHaveBeenCalled()
    expect(provider.searchAlbum).not.toHaveBeenCalled()
    expect(provider.searchPlaylist).not.toHaveBeenCalled()
  })

  it('takes the id out of a share link of the same platform and kind', async () => {
    lookup.lookupById.mockResolvedValue([{ id: 'found' }])
    await searchMusicMetadata({
      ...base,
      source: 'tencent',
      keyword: 'https://y.qq.com/n/ryqq/songDetail/003VHaBb0wCHop',
      type: 'song',
    })
    expect(lookup.lookupById).toHaveBeenCalledExactlyOnceWith('tencent', 'song', '003VHaBb0wCHop')
  })

  it.each([
    ['nothing is found', () => lookup.lookupById.mockResolvedValue([])],
    ['the lookup fails', () => lookup.lookupById.mockRejectedValue(new Error('SEARCH_UPSTREAM'))],
  ])('searches for the words after all when %s', async (_name, arrange) => {
    arrange()
    provider.search.mockResolvedValue([{ id: 'by-name' }])
    await expect(
      searchMusicMetadata({ ...base, source: 'netease', keyword: '1901371647', type: 'song' }),
    ).resolves.toEqual({ tracks: [{ id: 'by-name' }], page: 1, hasMore: false })
    expect(provider.search).toHaveBeenCalledWith('netease', '1901371647', 20, 1)
  })

  it.each([
    ['ordinary words', 'netease', '周杰伦', 'song', 1],
    ['a short number (a year, a band)', 'netease', '1975', 'artist', 1],
    ['a link to another platform', 'netease', 'https://y.qq.com/n/ryqq/songDetail/003VHaBb0wCHop', 'song', 1],
    ['an artist on a platform without artist pages', 'tencent', '003VHaBb0wCHop', 'artist', 1],
    ['a second page', 'netease', '3778678', 'playlist', 2],
  ] as const)('is searched for by name, without a lookup, for %s', async (_name, source, keyword, type, page) => {
    provider.search.mockResolvedValue([])
    provider.searchAlbum.mockResolvedValue([])
    provider.searchPlaylist.mockResolvedValue([])
    await searchMusicMetadata({ limit: 20, page, source, keyword, type }).catch(() => undefined)
    expect(lookup.lookupById).not.toHaveBeenCalled()
  })
})

describe('discovery', () => {
  const query = { source: 'netease', roomId: 'ROOM01' } as const

  it('reads the radar list for everyone and wraps it as items', async () => {
    discover.getRadar.mockResolvedValue([{ id: '1' }])
    await expect(getRadarMetadata({ source: 'netease' })).resolves.toEqual({ items: [{ id: '1' }] })
    expect(discover.getRadar).toHaveBeenCalledExactlyOnceWith('netease')
  })

  it("reads today's songs with the verified caller's own login in that room", async () => {
    rooms.get.mockReturnValue({ users: [{ id: 'mapp_me' }] })
    accounts.getUserCookie.mockReturnValue('MUSIC_U=mine')
    discover.getDaily.mockResolvedValue([{ id: 't' }])
    await expect(getDailyMetadata(query, 'mapp_me')).resolves.toEqual({ items: [{ id: 't' }] })
    expect(accounts.getUserCookie).toHaveBeenCalledExactlyOnceWith('mapp_me', 'netease', 'ROOM01')
    expect(discover.getDaily).toHaveBeenCalledExactlyOnceWith('netease', 'MUSIC_U=mine')
  })

  it('passes "not logged in" on so the service can ask for a login', async () => {
    rooms.get.mockReturnValue({ users: [{ id: 'mapp_me' }] })
    accounts.getUserCookie.mockReturnValue(null)
    discover.getDaily.mockResolvedValue([])
    await getDailyMetadata(query, 'mapp_me')
    expect(discover.getDaily).toHaveBeenCalledExactlyOnceWith('netease', null)
  })

  it.each([
    ['no identity', undefined, { users: [{ id: 'mapp_me' }] }],
    ['a stranger to the room', 'mapp_other', { users: [{ id: 'mapp_me' }] }],
    ['a missing room', 'mapp_me', undefined],
  ])('refuses %s without touching accounts or NetEase', (_name, userId, room) => {
    rooms.get.mockReturnValue(room)
    expect(() => getDailyMetadata(query, userId)).toThrow(PlaylistAccessError)
    expect(accounts.getUserCookie).not.toHaveBeenCalled()
    expect(discover.getDaily).not.toHaveBeenCalled()
  })
})

describe('playlist pages', () => {
  const page = { tracks: [{ id: 't' }], total: 5, hasMore: true }

  it('reads a public page anonymously and treats total 0 as unknown', async () => {
    provider.getPlaylistPage.mockResolvedValue(page)
    const result = await getPlaylistPageMetadata(
      { source: 'netease', id: '9', limit: 50, offset: 10, total: 0, type: 'album' },
      null,
    )
    expect(result).toEqual({ tracks: page.tracks, total: 5, offset: 10, hasMore: true })
    expect(provider.getPlaylistPage).toHaveBeenCalledExactlyOnceWith('netease', '9', 50, 10, undefined, null, 'album')
  })

  describe('own playlist', () => {
    const query = {
      source: 'netease',
      id: '9',
      limit: 50,
      offset: 0,
      total: 7,
      roomId: 'ROOM01',
      type: 'playlist',
    } as const

    it("uses the verified caller's own login in that room", async () => {
      rooms.get.mockReturnValue({ users: [{ id: 'mapp_me' }, { id: 'someone-else' }] })
      accounts.getUserCookie.mockReturnValue('MUSIC_U=mine')
      provider.getPlaylistPage.mockResolvedValue(page)
      await getMyPlaylistPageMetadata(query, 'mapp_me')
      expect(accounts.getUserCookie).toHaveBeenCalledExactlyOnceWith('mapp_me', 'netease', 'ROOM01')
      expect(provider.getPlaylistPage).toHaveBeenCalledExactlyOnceWith(
        'netease',
        '9',
        50,
        0,
        7,
        'MUSIC_U=mine',
        'playlist',
      )
    })

    it('falls back to an anonymous read when the caller has no login in the room', async () => {
      rooms.get.mockReturnValue({ users: [{ id: 'mapp_me' }] })
      accounts.getUserCookie.mockReturnValue(null)
      provider.getPlaylistPage.mockResolvedValue(page)
      await getMyPlaylistPageMetadata(query, 'mapp_me')
      expect(provider.getPlaylistPage.mock.calls[0][5]).toBeNull()
    })

    it.each([
      ['an unauthenticated caller', undefined, { users: [{ id: 'mapp_me' }] }, 401],
      ['a caller who is not in the room', 'mapp_other', { users: [{ id: 'mapp_me' }] }, 403],
      ['a room that does not exist', 'mapp_me', undefined, 403],
    ])('refuses %s before any account or provider is touched', async (_name, userId, room, status) => {
      rooms.get.mockReturnValue(room)
      expect(() => getMyPlaylistPageMetadata(query, userId)).toThrow(PlaylistAccessError)
      try {
        getMyPlaylistPageMetadata(query, userId)
      } catch (error) {
        expect((error as PlaylistAccessError).status).toBe(status)
      }
      expect(accounts.getUserCookie).not.toHaveBeenCalled()
      expect(provider.getPlaylistPage).not.toHaveBeenCalled()
    })
  })
})

describe('public metadata controller shared by Web and platform', () => {
  it.each(['song', 'album', 'playlist'] as const)(
    'preserves the anonymous %s search branch and page response',
    async (type) => {
      const method =
        type === 'song' ? provider.search : type === 'album' ? provider.searchAlbum : provider.searchPlaylist
      const tracks = [{ id: 'public-fixture' }, { id: 'public-second' }]
      method.mockResolvedValueOnce(tracks)
      expect(await searchMusicMetadata({ source: 'netease', keyword: 'fixture', limit: 2, page: 3, type })).toEqual({
        tracks,
        page: 3,
        hasMore: true,
      })
      expect(method).toHaveBeenCalledExactlyOnceWith('netease', 'fixture', 2, 3)
      for (const other of [provider.search, provider.searchAlbum, provider.searchPlaylist]) {
        if (other !== method) expect(other).not.toHaveBeenCalled()
      }
    },
  )

  it('preserves the short-page response without introducing credentials', async () => {
    provider.search.mockResolvedValueOnce([])
    expect(
      await searchMusicMetadata({ source: 'kugou', keyword: 'fixture', limit: 20, page: 1, type: 'song' }),
    ).toEqual({ tracks: [], page: 1, hasMore: false })
    expect(provider.search.mock.calls[0]).toHaveLength(4)
  })

  it('returns the original lyric payload from the existing provider', async () => {
    const lyric = { lyric: '[00:00.00]Fixture', tlyric: '', romalrc: '', yrc: '' }
    provider.getLyric.mockResolvedValueOnce(lyric)
    expect(await getMusicLyricMetadata({ source: 'tencent', lyricId: 'fixture-id' })).toBe(lyric)
    expect(provider.getLyric).toHaveBeenCalledExactlyOnceWith('tencent', 'fixture-id')
  })

  it('leaves error handling to the existing Web wrapper or the opt-in platform boundary', async () => {
    const failure = new Error('fixture-provider-failure')
    provider.search.mockRejectedValueOnce(failure)
    await expect(
      searchMusicMetadata({ source: 'netease', keyword: 'fixture', limit: 20, page: 1, type: 'song' }),
    ).rejects.toBe(failure)
  })
})
