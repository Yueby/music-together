import { afterEach, describe, expect, it, vi } from 'vitest'
import Meting from '@meting/core'
import { LRUCache } from 'lru-cache'
import * as tencentAuth from './tencentAuthService.js'
import {
  deriveThumbnailCoverUrl,
  musicProvider,
  normalizeKugouTemplateCoverUrl,
  normalizeNeteaseCoverUrl,
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

  it('keeps Cookie requests uncached and passes the Cookie to Meting', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now)
    const anonymous = signedUrl('20260720090000')
    const authorized = signedUrl('20260720100000')
    const request = vi
      .spyOn(Meting.prototype, 'url')
      .mockResolvedValueOnce(JSON.stringify({ url: anonymous }))
      .mockResolvedValue(JSON.stringify({ url: authorized }))
    const cookie = vi.spyOn(Meting.prototype, 'cookie')

    await expect(musicProvider.getStreamUrl('netease', 'lifetime-cookie-fixture')).resolves.toBe(anonymous)
    await expect(musicProvider.getStreamUrl('netease', 'lifetime-cookie-fixture', 320, 'fixture-cookie')).resolves.toBe(
      authorized,
    )
    await expect(musicProvider.getStreamUrl('netease', 'lifetime-cookie-fixture', 320, 'fixture-cookie')).resolves.toBe(
      authorized,
    )
    await expect(musicProvider.getStreamUrl('netease', 'lifetime-cookie-fixture')).resolves.toBe(anonymous)
    expect(request).toHaveBeenCalledTimes(3)
    expect(cookie).toHaveBeenCalledTimes(2)
    expect(cookie).toHaveBeenNthCalledWith(1, 'fixture-cookie')
    expect(cookie).toHaveBeenNthCalledWith(2, 'fixture-cookie')
  })

  it('also rejects expired URLs returned for Cookie requests', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now)
    vi.spyOn(Meting.prototype, 'url').mockResolvedValue(JSON.stringify({ url: signedUrl('20260719080000') }))
    await expect(
      musicProvider.getStreamUrl('netease', 'lifetime-cookie-expired-fixture', 320, 'fixture-cookie'),
    ).resolves.toBeNull()
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
