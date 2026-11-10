import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getMusicLyricMetadata, searchMusicMetadata } from './musicMetadataController.js'

const provider = vi.hoisted(() => ({
  search: vi.fn(),
  searchAlbum: vi.fn(),
  searchPlaylist: vi.fn(),
  getLyric: vi.fn(),
}))
vi.mock('../services/musicProvider.js', () => ({ musicProvider: provider }))
beforeEach(() => vi.resetAllMocks())

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
