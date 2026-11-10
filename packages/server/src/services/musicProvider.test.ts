import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Meting from '@meting/core'
import { LRUCache } from 'lru-cache'
import * as tencentAuth from './tencentAuthService.js'
import { getNeteasePlaybackUrl } from './neteasePlayback.js'

vi.mock('./neteasePlayback.js', () => ({ getNeteasePlaybackUrl: vi.fn() }))
import {
  deriveThumbnailCoverUrl,
  musicProvider,
  normalizeKugouTemplateCoverUrl,
  normalizeNeteaseCoverUrl,
  playlistCacheKey,
} from './musicProvider.js'

const tencentSong = {
  id: 410316279,
  mid: '003VHaBb0wCHop',
  name: 'Blank Space',
  interval: 231,
  singer: [{ id: 1, mid: 'singer-mid', name: 'Taylor Swift' }],
  album: {
    id: 1,
    mid: 'album-mid',
    pmid: '000MkMni19ClKG',
    name: '1989 (Taylor’s Version)',
  },
  pay: { pay_down: 0, pay_month: 1, pay_play: 0, price_track: 0 },
  action: { msgpay: 0 },
}

beforeEach(() => {
  vi.mocked(getNeteasePlaybackUrl).mockReset().mockResolvedValue(null)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Tencent music search', () => {
  it('uses the signed desktop API profile and converts songs to tracks', async () => {
    const request = vi.spyOn(tencentAuth, 'requestSignedApi').mockResolvedValue({
      body: { song: { list: [tencentSong] } },
      meta: { curpage: 1, perpage: 20, sum: 1, nextpage: -1 },
    })

    const tracks = await musicProvider.search('tencent', 'blank space test fixture', 20, 1)

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'music.search.SearchCgiService',
        method: 'DoSearchForQQMusicDesktop',
        comm: { ct: 19, cv: 2201 },
        param: expect.objectContaining({ query: 'blank space test fixture', search_type: 0 }),
      }),
    )
    expect(tracks).toHaveLength(1)
    expect(tracks[0]).toMatchObject({
      source: 'tencent',
      sourceId: '003VHaBb0wCHop',
      title: 'Blank Space',
      artist: ['Taylor Swift'],
      duration: 231,
      cover: 'https://y.gtimg.cn/music/photo_new/T002R800x800M000000MkMni19ClKG.jpg',
      thumbnailCover: 'https://y.gtimg.cn/music/photo_new/T002R120x120M000000MkMni19ClKG.jpg',
      vip: true,
    })
  })

  it('returns an empty list for malformed upstream song data', async () => {
    vi.spyOn(tencentAuth, 'requestSignedApi').mockResolvedValue({
      body: {},
      meta: { curpage: 1, perpage: 20, sum: 0, nextpage: -1 },
    } as never)

    await expect(musicProvider.search('tencent', 'malformed test fixture', 20, 1)).resolves.toEqual([])
  })

  it('returns an empty list when the signed request fails', async () => {
    vi.spyOn(tencentAuth, 'requestSignedApi').mockRejectedValue(new Error('upstream unavailable'))

    await expect(musicProvider.search('tencent', 'failure test fixture', 20, 1)).resolves.toEqual([])
  })
})

describe('stream URL lifetime caching', () => {
  const now = Date.parse('2026-07-20T00:00:00Z')
  const signedUrl = (timestamp: string) =>
    `https://m801.music.126.net/${timestamp}/fixture-signature/ymusic/fixture.mp3`

  it('re-fetches an expired cache hit normally and applies per-entry TTL', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
    const first = signedUrl('20260720081000')
    const fresh = signedUrl('20260720090000')
    const request = vi
      .spyOn(Meting.prototype, 'url')
      .mockResolvedValueOnce(JSON.stringify({ url: first }))
      .mockResolvedValueOnce(JSON.stringify({ url: fresh }))
    const set = vi.spyOn(LRUCache.prototype, 'set')

    await expect(musicProvider.getStreamUrl('netease', 'lifetime-cache-fixture')).resolves.toBe(first)
    expect(set).toHaveBeenCalledWith('netease:lifetime-cache-fixture:320', first, { ttl: 570_000 })
    await expect(musicProvider.getStreamUrl('netease', 'lifetime-cache-fixture')).resolves.toBe(first)
    expect(request).toHaveBeenCalledTimes(1)

    // Change wall time only: the LRU entry is still present, so the explicit expiry guard must evict it.
    clock.mockReturnValue(now + 570_000)
    await expect(musicProvider.getStreamUrl('netease', 'lifetime-cache-fixture')).resolves.toBe(fresh)
    expect(request).toHaveBeenCalledTimes(2)
    expect(request).toHaveBeenLastCalledWith('lifetime-cache-fixture', 320)
  })

  it('rejects expired upstream URLs and leaves them uncached', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now)
    const request = vi
      .spyOn(Meting.prototype, 'url')
      .mockResolvedValueOnce(JSON.stringify({ url: signedUrl('20260719080000') }))
      .mockResolvedValueOnce(JSON.stringify({ url: signedUrl('20260720080030') }))
    const set = vi.spyOn(LRUCache.prototype, 'set')

    await expect(musicProvider.getStreamUrl('netease', 'lifetime-expired-fixture')).resolves.toBeNull()
    await expect(musicProvider.getStreamUrl('netease', 'lifetime-expired-fixture')).resolves.toBeNull()
    expect(request).toHaveBeenCalledTimes(2)
    expect(set).not.toHaveBeenCalledWith('netease:lifetime-expired-fixture:320', expect.anything(), expect.anything())
  })

  it('routes Cookie requests to the SDK helper without sharing the anonymous cache', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now)
    const anonymous = signedUrl('20260720090000')
    const authorized = signedUrl('20260720100000')
    const request = vi.spyOn(Meting.prototype, 'url').mockResolvedValue(JSON.stringify({ url: anonymous }))
    vi.mocked(getNeteasePlaybackUrl).mockResolvedValue(authorized)
    const cookie = vi.spyOn(Meting.prototype, 'cookie')

    await expect(musicProvider.getStreamUrl('netease', 'lifetime-cookie-fixture')).resolves.toBe(anonymous)
    await expect(musicProvider.getStreamUrl('netease', 'lifetime-cookie-fixture', 320, 'fixture-cookie')).resolves.toBe(
      authorized,
    )
    await expect(musicProvider.getStreamUrl('netease', 'lifetime-cookie-fixture', 320, 'fixture-cookie')).resolves.toBe(
      authorized,
    )
    await expect(musicProvider.getStreamUrl('netease', 'lifetime-cookie-fixture')).resolves.toBe(anonymous)
    expect(request).toHaveBeenCalledTimes(1)
    expect(cookie).not.toHaveBeenCalled()
    expect(getNeteasePlaybackUrl).toHaveBeenCalledTimes(2)
    expect(getNeteasePlaybackUrl).toHaveBeenNthCalledWith(1, 'lifetime-cookie-fixture', 320, 'fixture-cookie')
    expect(getNeteasePlaybackUrl).toHaveBeenNthCalledWith(2, 'lifetime-cookie-fixture', 320, 'fixture-cookie')
  })

  it('returns null when authenticated playback fails without falling back to Meting', async () => {
    const request = vi.spyOn(Meting.prototype, 'url')
    vi.mocked(getNeteasePlaybackUrl).mockResolvedValue(null)
    await expect(
      musicProvider.getStreamUrl('netease', 'lifetime-cookie-expired-fixture', 320, 'fixture-cookie'),
    ).resolves.toBeNull()
    expect(getNeteasePlaybackUrl).toHaveBeenCalledWith('lifetime-cookie-expired-fixture', 320, 'fixture-cookie')
    expect(request).not.toHaveBeenCalled()
  })

  it('resolves each Cookie request independently and preserves the helper URL verbatim', async () => {
    const first = `${signedUrl('20260720090000')}?token=a%2Bb&x=1`
    const second = `${signedUrl('20260720100000')}?token=c%2Bd&x=2`
    vi.mocked(getNeteasePlaybackUrl).mockResolvedValueOnce(first).mockResolvedValueOnce(second)
    const set = vi.spyOn(LRUCache.prototype, 'set')
    await expect(musicProvider.getStreamUrl('netease', '110', 999, 'cookie-one')).resolves.toBe(first)
    await expect(musicProvider.getStreamUrl('netease', '110', 999, 'cookie-two')).resolves.toBe(second)
    expect(getNeteasePlaybackUrl).toHaveBeenNthCalledWith(1, '110', 999, 'cookie-one')
    expect(getNeteasePlaybackUrl).toHaveBeenNthCalledWith(2, '110', 999, 'cookie-two')
    expect(set).not.toHaveBeenCalled()
  })

  it.each(['tencent', 'kugou'] as const)('keeps authenticated %s playback on fresh Meting instances', async (source) => {
    const url = 'https://fixture.example/audio.mp3'
    const request = vi.spyOn(Meting.prototype, 'url').mockResolvedValue(JSON.stringify({ url }))
    const cookie = vi.spyOn(Meting.prototype, 'cookie')
    await expect(musicProvider.getStreamUrl(source, 'other-source-fixture', 192, 'fixture-cookie')).resolves.toBe(url)
    expect(request).toHaveBeenCalledExactlyOnceWith('other-source-fixture', 192)
    expect(cookie).toHaveBeenCalledExactlyOnceWith('fixture-cookie')
    expect(getNeteasePlaybackUrl).not.toHaveBeenCalled()
  })

  it('uses five minutes for opaque NetEase URLs while preserving HTTPS normalization', async () => {
    vi.spyOn(Meting.prototype, 'url').mockResolvedValue(
      JSON.stringify({ url: 'http://music.126.net/ymusic/fixture.mp3' }),
    )
    const set = vi.spyOn(LRUCache.prototype, 'set')
    await expect(musicProvider.getStreamUrl('netease', 'lifetime-opaque-fixture')).resolves.toBe(
      'https://music.126.net/ymusic/fixture.mp3',
    )
    expect(set).toHaveBeenCalledWith(
      'netease:lifetime-opaque-fixture:320',
      'https://music.126.net/ymusic/fixture.mp3',
      { ttl: 300_000 },
    )
  })
})

describe('provider cover URL normalization', () => {
  it('removes NetEase size params while preserving other query parameters', () => {
    expect(normalizeNeteaseCoverUrl('https://music.163.com/a.jpg?foo=bar&param=100y100&param=200y200')).toBe(
      'https://music.163.com/a.jpg?foo=bar',
    )
    expect(normalizeNeteaseCoverUrl('https://music.163.com/a.jpg?foo=bar')).toBe('https://music.163.com/a.jpg?foo=bar')
  })

  it('converts documented Kugou size templates to the CDN-safe maximum request', () => {
    expect(normalizeKugouTemplateCoverUrl('http://img.kugou.com/{size}/abc.jpg')).toBe(
      'http://img.kugou.com/5000/abc.jpg',
    )
    expect(normalizeKugouTemplateCoverUrl('http://img.kugou.com/400/abc.jpg')).toBe('http://img.kugou.com/400/abc.jpg')
  })

  it('derives safe provider-specific 120px thumbnail URLs', () => {
    expect(deriveThumbnailCoverUrl('netease', 'https://music.163.com/a.jpg?foo=bar&param=800y800')).toBe(
      'https://music.163.com/a.jpg?foo=bar&param=120y120',
    )
    expect(deriveThumbnailCoverUrl('tencent', 'https://y.gtimg.cn/music/photo_new/T002R800x800M000abc.jpg')).toBe(
      'https://y.gtimg.cn/music/photo_new/T002R120x120M000abc.jpg',
    )
    expect(deriveThumbnailCoverUrl('kugou', 'http://img.kugou.com/{size}/abc.jpg')).toBe(
      'http://img.kugou.com/120/abc.jpg',
    )
    expect(deriveThumbnailCoverUrl('kugou', 'https://example.com/5000/abc.jpg')).toBe(
      'https://example.com/5000/abc.jpg',
    )
  })
})

describe('playlistCacheKey', () => {
  it('keeps albums and playlists with the same numeric id apart', () => {
    expect(playlistCacheKey('netease', '123', 'album')).not.toBe(playlistCacheKey('netease', '123', 'playlist'))
  })

  it('keeps platforms apart', () => {
    expect(playlistCacheKey('netease', '123', 'playlist')).not.toBe(playlistCacheKey('tencent', '123', 'playlist'))
  })

  it('never shares an entry fetched with a cookie with anonymous callers or other accounts', () => {
    const anonymous = playlistCacheKey('netease', '123', 'playlist')
    const alice = playlistCacheKey('netease', '123', 'playlist', 'MUSIC_U=alice-secret')
    const bob = playlistCacheKey('netease', '123', 'playlist', 'MUSIC_U=bob-secret')
    expect(new Set([anonymous, alice, bob]).size).toBe(3)
    // An empty cookie is anonymous, and the same cookie always maps to the same entry.
    expect(playlistCacheKey('netease', '123', 'playlist', '')).toBe(anonymous)
    expect(playlistCacheKey('netease', '123', 'playlist', 'MUSIC_U=alice-secret')).toBe(alice)
  })

  it('does not put the cookie itself into the key', () => {
    expect(playlistCacheKey('netease', '123', 'playlist', 'MUSIC_U=alice-secret')).not.toContain('alice')
  })
})

describe('ingestNeteaseSongs', () => {
  const song = (id: number, extra: Record<string, unknown> = {}) => ({
    id,
    name: `Song ${id}`,
    ar: [{ name: 'JJ' }, { name: 'Guest' }],
    al: { name: 'Album', pic_str: '109951', picUrl: 'https://p3.music.126.net/cover.jpg?param=130y130' },
    dt: 215_000,
    fee: 0,
    ...extra,
  })

  it('builds registered tracks with the album artwork the response already carries', () => {
    const [track] = musicProvider.ingestNeteaseSongs([song(1, { fee: 1 })])
    expect(track).toMatchObject({
      title: 'Song 1',
      artist: ['JJ', 'Guest'],
      album: 'Album',
      duration: 215,
      source: 'netease',
      sourceId: '1',
      urlId: '1',
      vip: true,
      cover: 'https://p3.music.126.net/cover.jpg',
    })
    expect(track.thumbnailCover).toContain('120y120')
  })

  it('skips entries without an id and tolerates a non-array response', () => {
    expect(musicProvider.ingestNeteaseSongs(undefined)).toEqual([])
    expect(musicProvider.ingestNeteaseSongs({ songs: [] })).toEqual([])
    const tracks = musicProvider.ingestNeteaseSongs([null, 'x', { name: 'no id' }, song(2)])
    expect(tracks.map((t) => t.sourceId)).toEqual(['2'])
  })
})
