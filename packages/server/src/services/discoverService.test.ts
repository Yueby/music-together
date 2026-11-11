import type { Track } from '@music-together/shared'
import { LRUCache } from 'lru-cache'
import { describe, expect, it, vi } from 'vitest'
import { createDiscoverService, DiscoverError, RADAR_PLAYLIST_IDS, type DiscoverNcm } from './discoverService.js'

vi.mock('./musicProvider.js', () => ({
  musicProvider: { ingestNeteaseSongs: vi.fn() },
}))

const track = (sourceId: string): Track => ({
  id: `local-${sourceId}`,
  title: `Song ${sourceId}`,
  artist: ['A'],
  album: 'B',
  duration: 200,
  cover: '',
  source: 'netease',
  sourceId,
  urlId: sourceId,
})

function setup(overrides: Partial<Record<keyof DiscoverNcm, ReturnType<typeof vi.fn>>> = {}) {
  const ncm = {
    playlist_detail: vi.fn(async ({ id }: { id: string }) => ({
      body: {
        code: 200,
        playlist: {
          id: Number(id),
          name: `Radar ${id}`,
          coverImgUrl: 'https://p1.music.126.net/c.jpg?param=130y130',
          trackCount: 30,
          creator: { nickname: '云音乐私人雷达' },
          description: ' desc ',
        },
      },
    })),
    recommend_songs: vi.fn().mockResolvedValue({
      body: { code: 200, data: { dailySongs: [{ id: 1 }, { id: 2 }] } },
    }),
    recommend_resource: vi.fn().mockResolvedValue({
      body: {
        code: 200,
        recommend: [
          {
            id: 11,
            name: '每日歌单',
            picUrl: 'http://p1.music.126.net/a.jpg',
            copywriter: ' 根据你的口味 ',
            trackCount: 40,
          },
          { id: 3136952023, name: '私人雷达', picUrl: 'http://p1.music.126.net/b.jpg' },
          // An ordinary playlist that merely has the word in its title is a normal recommendation.
          { id: 13, name: '新歌雷达精选', picUrl: 'http://p1.music.126.net/f.jpg', trackCount: 8 },
          { id: 'x', name: 'bad id' },
        ],
      },
    }),
    personalized: vi.fn().mockResolvedValue({
      body: {
        code: 200,
        result: [{ id: 21, name: '热门歌单', picUrl: 'https://p1.music.126.net/c.jpg', trackCount: 9 }],
      },
    }),
    top_artists: vi.fn().mockResolvedValue({
      body: {
        code: 200,
        artists: [
          { id: 31, name: '歌手甲', picUrl: 'http://p1.music.126.net/d.jpg', albumSize: 3, musicSize: 40 },
          { id: 0 },
        ],
      },
    }),
    album_new: vi.fn().mockResolvedValue({
      body: {
        code: 200,
        albums: [
          { id: 41, name: '新专辑', picUrl: 'http://p1.music.126.net/e.jpg', size: 10, artist: { name: '歌手甲' } },
        ],
      },
    }),
    ...overrides,
  }
  // Like the real ingestion: anything that is not a list of songs yields no tracks.
  const ingestSongs = vi.fn((songs: unknown) =>
    Array.isArray(songs) ? (songs as { id: number }[]).map((song) => track(String(song.id))) : [],
  )
  const service = createDiscoverService({ ncm: ncm as unknown as DiscoverNcm, ingestSongs, timeoutMs: 50 })
  return { ncm, ingestSongs, service }
}

describe('discoverService radar', () => {
  // Radar lists are shown as a cover grid: their tiles get a larger thumbnail than the 120px list rows.
  it('lists every radar playlist anonymously with artwork, count and creator', async () => {
    const { service, ncm } = setup()
    const radar = await service.getRadar('netease')
    expect(ncm.playlist_detail).toHaveBeenCalledTimes(RADAR_PLAYLIST_IDS.length)
    expect(radar.map((list) => list.id)).toEqual([...RADAR_PLAYLIST_IDS])
    expect(radar[0]).toEqual({
      id: '3136952023',
      name: 'Radar 3136952023',
      cover: 'https://p1.music.126.net/c.jpg',
      thumbnailCover: 'https://p1.music.126.net/c.jpg?param=256y256',
      trackCount: 30,
      source: 'netease',
      creator: '云音乐私人雷达',
      description: 'desc',
    })
    // No account is involved in this call.
    for (const [query] of ncm.playlist_detail.mock.calls) expect(query).not.toHaveProperty('cookie')
  })

  it('serves artwork over https even when NetEase answers with http addresses', async () => {
    const { service, ncm } = setup()
    ncm.playlist_detail.mockImplementation(async ({ id }: { id: string }) => ({
      body: { code: 200, playlist: { id: Number(id), name: 'r', coverImgUrl: 'http://p1.music.126.net/x==/1.jpg' } },
    }))
    const [first] = await service.getRadar('netease')
    expect(first.cover).toBe('https://p1.music.126.net/x==/1.jpg')
    expect(first.thumbnailCover).toBe('https://p1.music.126.net/x==/1.jpg?param=256y256')
  })

  it('skips a radar list that fails and still answers with the others', async () => {
    const { service, ncm } = setup()
    ncm.playlist_detail.mockImplementation(async ({ id }: { id: string }) => {
      if (id === RADAR_PLAYLIST_IDS[1]) throw new Error('boom')
      if (id === RADAR_PLAYLIST_IDS[2]) return { body: { code: 404 } }
      return { body: { code: 200, playlist: { id: Number(id), name: `Radar ${id}` } } }
    })
    const radar = await service.getRadar('netease')
    expect(radar.map((list) => list.id)).not.toContain(RADAR_PLAYLIST_IDS[1])
    expect(radar.map((list) => list.id)).not.toContain(RADAR_PLAYLIST_IDS[2])
    expect(radar).toHaveLength(RADAR_PLAYLIST_IDS.length - 2)
  })

  it('fails with a sanitized upstream error when no list can be read, and does not cache the failure', async () => {
    const { service, ncm } = setup()
    ncm.playlist_detail.mockRejectedValue(new Error('cookie=secret'))
    const failure = await service.getRadar('netease').catch((error: unknown) => error)
    expect(failure).toMatchObject({ code: 'DISCOVER_UPSTREAM', status: 503, message: 'DISCOVER_UPSTREAM' })
    ncm.playlist_detail.mockImplementation(async ({ id }: { id: string }) => ({
      body: { code: 200, playlist: { id: Number(id), name: 'ok' } },
    }))
    await expect(service.getRadar('netease')).resolves.toHaveLength(RADAR_PLAYLIST_IDS.length)
  })

  it('keeps a partial radar answer only briefly, but a complete one for the full hour', async () => {
    const set = vi.spyOn(LRUCache.prototype, 'set')
    try {
      const partial = setup()
      partial.ncm.playlist_detail.mockImplementation(async ({ id }: { id: string }) => {
        if (id === RADAR_PLAYLIST_IDS[0]) throw new Error('boom')
        return { body: { code: 200, playlist: { id: Number(id), name: `Radar ${id}` } } }
      })
      await expect(partial.service.getRadar('netease')).resolves.toHaveLength(RADAR_PLAYLIST_IDS.length - 1)
      expect(set).toHaveBeenCalledTimes(1)
      expect(set).toHaveBeenLastCalledWith('radar', expect.any(Array), { ttl: 2 * 60_000 })

      set.mockClear()
      const complete = setup()
      await expect(complete.service.getRadar('netease')).resolves.toHaveLength(RADAR_PLAYLIST_IDS.length)
      expect(set).toHaveBeenCalledTimes(1)
      // No explicit lifetime: the default one-hour TTL of the radar cache applies.
      expect(set).toHaveBeenLastCalledWith('radar', expect.any(Array))
    } finally {
      set.mockRestore()
    }
  })

  it('caches the list and shares a concurrent request', async () => {
    const { service, ncm } = setup()
    await Promise.all([service.getRadar('netease'), service.getRadar('netease')])
    await service.getRadar('netease')
    expect(ncm.playlist_detail).toHaveBeenCalledTimes(RADAR_PLAYLIST_IDS.length)
  })

  it.each(['tencent', 'kugou'] as const)(
    'answers an explicit "unsupported" for %s without any upstream call',
    async (source) => {
      const { service, ncm } = setup()
      await expect(service.getRadar(source)).rejects.toMatchObject({ code: 'DISCOVER_UNSUPPORTED', status: 400 })
      expect(ncm.playlist_detail).not.toHaveBeenCalled()
    },
  )
})

describe('discoverService daily songs', () => {
  it("reads the songs with the caller's own login and registers them as tracks", async () => {
    const { service, ncm, ingestSongs } = setup()
    const songs = await service.getDaily('netease', 'MUSIC_U=alice')
    expect(ncm.recommend_songs).toHaveBeenCalledWith(expect.objectContaining({ cookie: 'MUSIC_U=alice' }))
    expect(ingestSongs).toHaveBeenCalledWith([{ id: 1 }, { id: 2 }])
    expect(songs.map((t) => t.sourceId)).toEqual(['1', '2'])
  })

  it('requires a login and never calls NetEase without one', async () => {
    const { service, ncm } = setup()
    await expect(service.getDaily('netease', null)).rejects.toMatchObject({
      code: 'DISCOVER_LOGIN_REQUIRED',
      status: 401,
    })
    expect(ncm.recommend_songs).not.toHaveBeenCalled()
  })

  it("keeps each account's list apart and caches per account", async () => {
    const { service, ncm } = setup()
    ncm.recommend_songs.mockImplementation(async ({ cookie }: { cookie: string }) => ({
      body: { code: 200, data: { dailySongs: [{ id: cookie === 'MUSIC_U=alice' ? 1 : 2 }] } },
    }))
    const alice = await service.getDaily('netease', 'MUSIC_U=alice')
    const bob = await service.getDaily('netease', 'MUSIC_U=bob')
    expect(alice.map((t) => t.sourceId)).toEqual(['1'])
    expect(bob.map((t) => t.sourceId)).toEqual(['2'])
    await service.getDaily('netease', 'MUSIC_U=alice')
    expect(ncm.recommend_songs).toHaveBeenCalledTimes(2)
  })

  it.each([301, 401])('treats business code %i as "login required"', async (code) => {
    const { service } = setup({ recommend_songs: vi.fn().mockResolvedValue({ body: { code } }) })
    await expect(service.getDaily('netease', 'MUSIC_U=expired')).rejects.toMatchObject({
      code: 'DISCOVER_LOGIN_REQUIRED',
      status: 401,
    })
  })

  it.each([
    ['another business code', { body: { code: 500 } }],
    ['a malformed body', { body: 'oops' }],
  ])('treats %s as a sanitized upstream failure', async (_name, response) => {
    const { service } = setup({ recommend_songs: vi.fn().mockResolvedValue(response) })
    const failure = await service.getDaily('netease', 'MUSIC_U=a').catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(DiscoverError)
    expect(failure).toMatchObject({ code: 'DISCOVER_UPSTREAM', status: 503 })
  })

  it('times out a stalled upstream call', async () => {
    const { service } = setup({ recommend_songs: vi.fn(() => new Promise(() => {})) })
    await expect(service.getDaily('netease', 'MUSIC_U=a')).rejects.toMatchObject({ code: 'DISCOVER_UPSTREAM' })
  })

  it('answers an empty day with an empty list, not an error', async () => {
    const { service } = setup({ recommend_songs: vi.fn().mockResolvedValue({ body: { code: 200, data: {} } }) })
    await expect(service.getDaily('netease', 'MUSIC_U=a')).resolves.toEqual([])
  })
})

describe('discoverService home blocks', () => {
  it("shows the account's own recommended playlists, without the radar lists, as https cover grid tiles", async () => {
    const { service, ncm } = setup()
    const home = await service.getHome('netease', 'MUSIC_U=alice')
    expect(ncm.recommend_resource).toHaveBeenCalledWith(expect.objectContaining({ cookie: 'MUSIC_U=alice' }))
    expect(ncm.personalized).not.toHaveBeenCalled()
    // The radar list (by id) is left out; a playlist that only has "雷达" in its title is not.
    expect(home.playlists.map((list) => list.id)).toEqual(['11', '13'])
    expect(home.playlists[0]).toEqual({
      id: '11',
      name: '每日歌单',
      cover: 'https://p1.music.126.net/a.jpg',
      thumbnailCover: 'https://p1.music.126.net/a.jpg?param=256y256',
      trackCount: 40,
      source: 'netease',
      creator: '',
      description: '根据你的口味',
    })
  })

  it('falls back to the generic recommendations without a login, with no cookie sent', async () => {
    const { service, ncm } = setup()
    const home = await service.getHome('netease', null)
    expect(ncm.recommend_resource).not.toHaveBeenCalled()
    expect(ncm.personalized.mock.calls[0][0]).not.toHaveProperty('cookie')
    expect(home.playlists.map((list) => list.id)).toEqual(['21'])
  })

  it('falls back to the generic recommendations when the saved login has expired', async () => {
    const { service, ncm } = setup()
    ncm.recommend_resource.mockResolvedValue({ body: { code: 301 } })
    const home = await service.getHome('netease', 'MUSIC_U=expired')
    expect(home.playlists.map((list) => list.id)).toEqual(['21'])
  })

  it('lists hot artists and new albums, skipping entries without a usable id or name', async () => {
    const { service } = setup()
    const home = await service.getHome('netease', null)
    expect(home.artists).toEqual([
      {
        id: '31',
        name: '歌手甲',
        cover: 'https://p1.music.126.net/d.jpg',
        thumbnailCover: 'https://p1.music.126.net/d.jpg?param=256y256',
        source: 'netease',
        albumCount: 3,
        songCount: 40,
      },
    ])
    expect(home.albums).toEqual([
      {
        id: '41',
        name: '新专辑',
        cover: 'https://p1.music.126.net/e.jpg',
        thumbnailCover: 'https://p1.music.126.net/e.jpg?param=256y256',
        trackCount: 10,
        source: 'netease',
        creator: '歌手甲',
      },
    ])
  })

  it('keeps the other blocks when one fails, and fails only when all of them do', async () => {
    const { service, ncm } = setup()
    ncm.top_artists.mockRejectedValue(new Error('cookie=secret'))
    const partial = await service.getHome('netease', null)
    expect(partial.artists).toEqual([])
    expect(partial.albums).toHaveLength(1)
    // The empty block is reported as failed, so the client offers a retry instead of "nothing here".
    expect(partial.failed).toEqual(['artists'])
    expect((await setup().service.getHome('netease', null)).failed).toEqual([])

    const failing = setup({
      personalized: vi.fn().mockRejectedValue(new Error('x')),
      top_artists: vi.fn().mockRejectedValue(new Error('x')),
      album_new: vi.fn().mockRejectedValue(new Error('x')),
    })
    await expect(failing.service.getHome('netease', null)).rejects.toMatchObject({
      code: 'DISCOVER_UPSTREAM',
      status: 503,
    })
  })

  it("shares the charts between everyone but keeps each account's playlists apart", async () => {
    const { service, ncm } = setup()
    await service.getHome('netease', 'MUSIC_U=alice')
    await service.getHome('netease', 'MUSIC_U=bob')
    await service.getHome('netease', 'MUSIC_U=alice')
    expect(ncm.recommend_resource).toHaveBeenCalledTimes(2)
    expect(ncm.top_artists).toHaveBeenCalledTimes(1)
    expect(ncm.album_new).toHaveBeenCalledTimes(1)
  })

  it.each(['tencent', 'kugou'] as const)(
    'answers an explicit "unsupported" for %s without any upstream call',
    async (source) => {
      const { service, ncm } = setup()
      await expect(service.getHome(source, null)).rejects.toMatchObject({ code: 'DISCOVER_UNSUPPORTED', status: 400 })
      expect(ncm.top_artists).not.toHaveBeenCalled()
    },
  )
})
