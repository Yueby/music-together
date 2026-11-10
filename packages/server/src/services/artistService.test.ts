import type { Track } from '@music-together/shared'
import { describe, expect, it, vi } from 'vitest'
import { ArtistError, createArtistService, type ArtistNcm } from './artistService.js'

vi.mock('./musicProvider.js', () => ({
  musicProvider: { ingestNeteaseSongs: vi.fn() },
  normalizeNeteaseCoverUrl: (url: string) => url.replace(/\?param=\w+/, ''),
  deriveThumbnailCoverUrl: (_source: string, url: string) => `${url}?param=120y120`,
}))

const track = (sourceId: string): Track => ({
  id: `local-${sourceId}`,
  title: `Song ${sourceId}`,
  artist: ['JJ'],
  album: 'Album',
  duration: 200,
  cover: '',
  source: 'netease',
  sourceId,
  urlId: sourceId,
})

function setup(overrides: Partial<Record<keyof ArtistNcm, ReturnType<typeof vi.fn>>> = {}) {
  const ncm = {
    cloudsearch: vi.fn().mockResolvedValue({
      body: {
        code: 200,
        result: {
          artists: [
            { id: 3684, name: '林俊杰', picUrl: 'https://p4.music.126.net/a.jpg', albumSize: 74, musicSize: 599 },
            { id: 'not-a-number', name: 'Broken' },
            { id: 99, name: '' },
          ],
        },
      },
    }),
    artists: vi.fn().mockResolvedValue({
      body: {
        code: 200,
        artist: { id: 3684, name: '林俊杰', picUrl: 'https://p4.music.126.net/a.jpg', briefDesc: ' 新加坡歌手 ', albumSize: 85, musicSize: 599 },
      },
    }),
    artist_songs: vi.fn().mockResolvedValue({ body: { code: 200, songs: [{ id: 1 }, { id: 2 }], more: true, total: 599 } }),
    artist_album: vi.fn().mockResolvedValue({
      body: {
        code: 200,
        hotAlbums: [
          { id: 10, name: 'Rise Without A Sound', size: 12, picUrl: 'https://p4.music.126.net/b.jpg', artist: { name: '林俊杰' } },
          { id: 'x', name: 'bad id' },
        ],
        more: false,
      },
    }),
    ...overrides,
  }
  const ingestSongs = vi.fn((songs: unknown) => (songs as { id: number }[]).map((song) => track(String(song.id))))
  const service = createArtistService({ ncm: ncm as unknown as ArtistNcm, ingestSongs, timeoutMs: 50 })
  return { ncm, ingestSongs, service }
}

describe('artistService', () => {
  describe('search', () => {
    it('maps NetEase artists, drops entries without a numeric id or name, and pages by offset', async () => {
      const { service, ncm } = setup()
      const artists = await service.search('netease', '林俊杰', 20, 3)
      expect(ncm.cloudsearch).toHaveBeenCalledWith({ keywords: '林俊杰', type: 100, limit: 20, offset: 40 })
      expect(artists).toEqual([
        {
          id: '3684',
          name: '林俊杰',
          cover: 'https://p4.music.126.net/a.jpg',
          thumbnailCover: 'https://p4.music.126.net/a.jpg?param=120y120',
          source: 'netease',
          albumCount: 74,
          songCount: 599,
        },
      ])
    })

    it('answers an empty list for platforms without artist data, without calling NetEase', async () => {
      const { service, ncm } = setup()
      await expect(service.search('tencent', 'x', 20, 1)).resolves.toEqual([])
      await expect(service.search('kugou', 'x', 20, 1)).resolves.toEqual([])
      expect(ncm.cloudsearch).not.toHaveBeenCalled()
    })

    it('caches a keyword and shares a concurrent lookup', async () => {
      const { service, ncm } = setup()
      await Promise.all([service.search('netease', 'jj', 20, 1), service.search('netease', 'jj', 20, 1)])
      await service.search('netease', 'jj', 20, 1)
      expect(ncm.cloudsearch).toHaveBeenCalledTimes(1)
    })
  })

  describe('getArtist', () => {
    it('combines profile, first song page and first album page', async () => {
      const { service, ncm, ingestSongs } = setup()
      const home = await service.getArtist('netease', '3684')
      expect(ncm.artist_songs).toHaveBeenCalledWith(expect.objectContaining({ id: '3684', offset: 0, limit: 50, order: 'hot' }))
      expect(ncm.artist_album).toHaveBeenCalledWith(expect.objectContaining({ id: '3684', offset: 0, limit: 30 }))
      expect(ingestSongs).toHaveBeenCalledTimes(1)
      expect(home.artist).toMatchObject({ id: '3684', name: '林俊杰', description: '新加坡歌手', albumCount: 85, songCount: 599 })
      expect(home.songs).toMatchObject({ hasMore: true, total: 599 })
      expect(home.songs.items.map((t) => t.sourceId)).toEqual(['1', '2'])
      expect(home.albums.hasMore).toBe(false)
      expect(home.albums.items).toEqual([
        expect.objectContaining({ id: '10', name: 'Rise Without A Sound', trackCount: 12, source: 'netease', creator: '林俊杰' }),
      ])
    })

    it('serves the second request from the cache and shares concurrent ones', async () => {
      const { service, ncm } = setup()
      await Promise.all([service.getArtist('netease', '3684'), service.getArtist('netease', '3684')])
      await service.getArtist('netease', '3684')
      expect(ncm.artists).toHaveBeenCalledTimes(1)
      expect(ncm.artist_songs).toHaveBeenCalledTimes(1)
      expect(ncm.artist_album).toHaveBeenCalledTimes(1)
    })

    it('rejects other platforms before any upstream call', async () => {
      const { service, ncm } = setup()
      await expect(service.getArtist('tencent', '1')).rejects.toMatchObject({ code: 'ARTIST_UNSUPPORTED', status: 400 })
      expect(ncm.artists).not.toHaveBeenCalled()
    })

    it('is 404 when the profile has no usable artist', async () => {
      const { service } = setup({ artists: vi.fn().mockResolvedValue({ body: { code: 200, artist: {} } }) })
      await expect(service.getArtist('netease', '1')).rejects.toMatchObject({ code: 'ARTIST_NOT_FOUND', status: 404 })
    })

    it.each([
      ['a business code other than 200', { body: { code: 400 } }],
      ['a 404 business code', { body: { code: 404 } }],
      ['a malformed body', { body: 'oops' }],
      ['no body at all', {}],
    ])('treats %s as a sanitized failure and does not cache it', async (_name, response) => {
      const artists = vi.fn().mockResolvedValue(response)
      const { service } = setup({ artists })
      const failure = await service.getArtist('netease', '1').catch((error: unknown) => error)
      expect(failure).toBeInstanceOf(ArtistError)
      expect((failure as ArtistError).message).toMatch(/^ARTIST_/)
      artists.mockResolvedValue({ body: { code: 200, artist: { id: 1, name: 'ok' } } })
      await expect(service.getArtist('netease', '1')).resolves.toMatchObject({ artist: { name: 'ok' } })
    })

    it('fails with a sanitized upstream error when NetEase throws or stalls', async () => {
      const throwing = setup({ artist_songs: vi.fn().mockRejectedValue(new Error('cookie=secret')) })
      const failure = await throwing.service.getArtist('netease', '1').catch((error: unknown) => error)
      // 503, not 502/504: Cloudflare would swap those for a page without CORS headers.
      expect(failure).toMatchObject({ code: 'ARTIST_UPSTREAM', status: 503, message: 'ARTIST_UPSTREAM' })

      const stalled = setup({ artists: vi.fn(() => new Promise(() => {})) })
      await expect(stalled.service.getArtist('netease', '1')).rejects.toMatchObject({ code: 'ARTIST_UPSTREAM' })
    })
  })

  describe('paging', () => {
    it('returns further songs from the requested offset', async () => {
      const { service, ncm } = setup()
      const page = await service.getSongs('netease', '3684', 50, 50)
      expect(ncm.artist_songs).toHaveBeenCalledWith(expect.objectContaining({ id: '3684', offset: 50, limit: 50 }))
      expect(page.items).toHaveLength(2)
      expect(page.hasMore).toBe(true)
    })

    it('returns further albums and reports the end', async () => {
      const { service, ncm } = setup()
      const page = await service.getAlbums('netease', '3684', 30, 30)
      expect(ncm.artist_album).toHaveBeenCalledWith(expect.objectContaining({ offset: 30, limit: 30 }))
      expect(page.hasMore).toBe(false)
    })

    it('does not mix cached pages of different artists, offsets or kinds', async () => {
      const { service, ncm } = setup()
      await service.getSongs('netease', '1', 0, 50)
      await service.getSongs('netease', '1', 50, 50)
      await service.getSongs('netease', '2', 0, 50)
      await service.getAlbums('netease', '1', 0, 50)
      expect(ncm.artist_songs).toHaveBeenCalledTimes(3)
      expect(ncm.artist_album).toHaveBeenCalledTimes(1)
    })
  })
})
