import { describe, expect, it } from 'vitest'
import { getStreamUrlCacheTtl, getStreamUrlExpiresAt, isStreamUrlExpired } from './streamUrlLifetime.js'

const now = Date.parse('2026-07-20T00:00:00Z')
const signedUrl = (timestamp: string) =>
  `https://m801.music.126.net/${timestamp}/fixture-signature/ymusic/fixture.mp3?fixture=1`

describe('stream URL lifetime', () => {
  it('reads known past/future CDN timestamps as UTC+8 without changing the URL', () => {
    expect(getStreamUrlExpiresAt('netease', signedUrl('20260719080000'))).toBe(now - 24 * 60 * 60 * 1000)
    expect(getStreamUrlExpiresAt('netease', signedUrl('20260721080000'))).toBe(now + 24 * 60 * 60 * 1000)
    expect(isStreamUrlExpired('netease', signedUrl('20260719080000'), now)).toBe(true)
    expect(isStreamUrlExpired('netease', signedUrl('20260721080000'), now)).toBe(false)
    expect(getStreamUrlExpiresAt('netease', 'http://music.126.net/20240229080000/fixture.mp3')).toBe(
      Date.parse('2024-02-29T00:00:00Z'),
    )
  })

  it('treats the exact 30-second margin as expired', () => {
    const url = signedUrl('20260720080030')
    expect(isStreamUrlExpired('netease', url, now - 1)).toBe(false)
    expect(isStreamUrlExpired('netease', url, now)).toBe(true)
    expect(isStreamUrlExpired('netease', url, now + 1)).toBe(true)
    expect(getStreamUrlCacheTtl('netease', url, now - 1)).toBe(1)
    expect(getStreamUrlCacheTtl('netease', url, now)).toBe(0)
    expect(getStreamUrlCacheTtl('netease', url, now + 1)).toBe(0)
  })

  it.each([
    '20260229080000',
    '20260431080000',
    '20260001080000',
    '20261301080000',
    '20260700080000',
    '20260720240000',
    '20260720086000',
    '20260720080060',
    '00000720080000',
  ])('rejects invalid calendar timestamp %s', (timestamp) => {
    expect(getStreamUrlExpiresAt('netease', signedUrl(timestamp))).toBeNull()
  })

  it.each([
    'https://example.com/20260720080000/fixture.mp3',
    'https://music.126.net.example.com/20260720080000/fixture.mp3',
    'https://notmusic.126.net/20260720080000/fixture.mp3',
    'ftp://music.126.net/20260720080000/fixture.mp3',
    'https://music.126.net/ymusic/20260720080000/fixture.mp3',
    'https://music.126.net/202607200800001/fixture.mp3',
    'https://music.126.net/fixture.mp3',
    'not a URL',
  ])('leaves unknown expiry opaque: %s', (url) => {
    expect(getStreamUrlExpiresAt('netease', url)).toBeNull()
    expect(isStreamUrlExpired('netease', url, now)).toBe(false)
    expect(getStreamUrlCacheTtl('netease', url, now)).toBe(5 * 60 * 1000)
  })

  it('caps known TTL at an hour and subtracts the safety margin', () => {
    expect(getStreamUrlCacheTtl('netease', signedUrl('20260721080000'), now)).toBe(60 * 60 * 1000)
    expect(getStreamUrlCacheTtl('netease', signedUrl('20260720081000'), now)).toBe(570_000)
    expect(getStreamUrlCacheTtl('netease', signedUrl('20260719080000'), now)).toBe(0)
  })

  it.each(['tencent', 'kugou'] as const)('preserves one-hour caching for %s', (source) => {
    const url = signedUrl('20260719080000')
    expect(getStreamUrlExpiresAt(source, url)).toBeNull()
    expect(isStreamUrlExpired(source, url, now)).toBe(false)
    expect(getStreamUrlCacheTtl(source, url, now)).toBe(60 * 60 * 1000)
  })
})
