import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getMusicLyricMetadata,
  getMyPlaylistPageMetadata,
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
const rooms = vi.hoisted(() => ({ get: vi.fn() }))
const accounts = vi.hoisted(() => ({ getUserCookie: vi.fn() }))
vi.mock('../services/musicProvider.js', () => ({ musicProvider: provider }))
vi.mock('../repositories/roomRepository.js', () => ({ roomRepo: rooms }))
vi.mock('../services/authService.js', () => accounts)
beforeEach(() => vi.resetAllMocks())

describe('playlist pages', () => {
  const page = { tracks: [{ id: 't' }], total: 5, hasMore: true }

  it('reads a public page anonymously and treats total 0 as unknown', async () => {
    provider.getPlaylistPage.mockResolvedValue(page)
    const result = await getPlaylistPageMetadata({ source: 'netease', id: '9', limit: 50, offset: 10, total: 0, type: 'album' }, null)
    expect(result).toEqual({ tracks: page.tracks, total: 5, offset: 10, hasMore: true })
    expect(provider.getPlaylistPage).toHaveBeenCalledExactlyOnceWith('netease', '9', 50, 10, undefined, null, 'album')
  })

  describe('own playlist', () => {
    const query = { source: 'netease', id: '9', limit: 50, offset: 0, total: 7, roomId: 'ROOM01', type: 'playlist' } as const

    it('uses the verified caller\'s own login in that room', async () => {
      rooms.get.mockReturnValue({ users: [{ id: 'mapp_me' }, { id: 'someone-else' }] })
      accounts.getUserCookie.mockReturnValue('MUSIC_U=mine')
      provider.getPlaylistPage.mockResolvedValue(page)
      await getMyPlaylistPageMetadata(query, 'mapp_me')
      expect(accounts.getUserCookie).toHaveBeenCalledExactlyOnceWith('mapp_me', 'netease', 'ROOM01')
      expect(provider.getPlaylistPage).toHaveBeenCalledExactlyOnceWith('netease', '9', 50, 0, 7, 'MUSIC_U=mine', 'playlist')
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
