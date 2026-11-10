import { describe, expect, it } from 'vitest'
import {
  MAPP_COVER_MAX_BYTES,
  MAPP_METADATA_MAX_BYTES,
  MAPP_METADATA_TARGETS,
  parseMappMetadataRequest,
  mappMetadataSearchQuerySchema,
  mappMetadataLyricQuerySchema,
} from './mappMetadata.js'

const search = '/api/music/search?source=netease&keyword=fixture'
const lyric = '/api/music/lyric?source=tencent&lyricId=fixture'
describe('reviewed metadata read contract', () => {
  it('publishes only search, lyric and cover targets, a one MiB JSON limit and a two MiB cover limit', () => {
    expect(MAPP_METADATA_MAX_BYTES).toBe(1024 * 1024)
    expect(MAPP_COVER_MAX_BYTES).toBe(2 * 1024 * 1024)
    expect(MAPP_METADATA_TARGETS).toEqual({
      search: {
        path: '/api/music/search',
        endpoint: 'musicSearch',
        queryKeys: ['source', 'keyword', 'limit', 'page', 'type'],
      },
      lyric: { path: '/api/music/lyric', endpoint: 'musicLyric', queryKeys: ['source', 'lyricId'] },
      cover: { path: '/api/music/cover-proxy', endpoint: 'musicCover', queryKeys: ['url'] },
    })
  })
  it('accepts a single plain https cover URL, whatever its host (the server owns the allowlist)', () => {
    const cover = 'https://p1.music.126.net/a/b.jpg?param=200y200'
    expect(parseMappMetadataRequest('/api/music/cover-proxy?url=' + encodeURIComponent(cover))).toMatchObject({
      kind: 'cover',
      query: { url: cover },
    })
    expect(parseMappMetadataRequest('/api/music/cover-proxy?url=https://evil.test/x.jpg').kind).toBe('cover')
  })
  it.each([
    '/api/music/cover-proxy',
    '/api/music/cover-proxy?url=',
    '/api/music/cover-proxy?url=http://p1.music.126.net/a.jpg',
    '/api/music/cover-proxy?url=//p1.music.126.net/a.jpg',
    '/api/music/cover-proxy?url=/a.jpg',
    '/api/music/cover-proxy?url=javascript:alert(1)',
    '/api/music/cover-proxy?url=data:image/png;base64,AAAA',
    '/api/music/cover-proxy?url=https%3A%2F%2Fuser%3Apass%40p1.music.126.net%2Fa.jpg',
    '/api/music/cover-proxy?url=https%3A%2F%2Fp1.music.126.net%2Fa.jpg%23frag',
    '/api/music/cover-proxy?url=https%3A%2F%2Fp1.music.126.net%2Fa%20b.jpg',
    '/api/music/cover-proxy?url=https://a.test/x&url=https://b.test/y',
    '/api/music/cover-proxy?url=https://a.test/x&extra=1',
    '/api/music/cover-proxy?url=https://a.test/x&roomId=ABC123',
    '/api/music/cover-proxy?url=https://a.test/x&mini_app_token=fixture',
    '/api/music/cover-proxy?url=' + encodeURIComponent('https://a.test/' + 'x'.repeat(2048)),
    '/api/music/cover-proxy/?url=https://a.test/x',
  ])('rejects unreviewed cover target %#', (raw) => {
    expect(() => parseMappMetadataRequest(raw)).toThrow()
  })
  it.each(['song', 'album', 'playlist'])('keeps anonymous catalog %s search', (type) => {
    expect(parseMappMetadataRequest(search + '&type=' + type)).toMatchObject({
      kind: 'search',
      query: { source: 'netease', keyword: 'fixture', limit: 20, page: 1, type },
    })
  })
  it('accepts only lyric identifiers and preserves parsed pagination', () => {
    expect(parseMappMetadataRequest(lyric)).toMatchObject({
      kind: 'lyric',
      query: { source: 'tencent', lyricId: 'fixture' },
    })
    expect(parseMappMetadataRequest(search + '&limit=10&page=2').query).toMatchObject({ limit: 10, page: 2 })
  })
  it.each([
    '/api/music/url?source=netease&urlId=fixture',
    '/api/music/cover?source=netease&picId=fixture',
    '/api/music/playlist?source=netease&id=fixture',
    '/api/music/ttml?url=https://evil.test',
    '/api/rooms',
    '/api/check',
    '/api/version',
    '/api/auth/status',
    '/api/music/privateplaylist',
    '/api/music/search/',
    '/API/music/search',
    'https://metadata.test' + search,
    '//metadata.test' + search,
    '/api/music/../music/search?source=netease&keyword=fixture',
    '/api/music/%73earch?source=netease&keyword=fixture',
    search + '&keyword=again',
    search + '&%6beyword=again',
    lyric + '&lyricId=again',
    search + '&cookie=fixture',
    search + '&userId=fixture',
    search + '&url=https://evil.test',
    search + '&roomId=ABC123',
    search + '&mini_app_token=fixture',
    search + '#fragment',
    search + '&extra=1',
    search.replace('fixture', '%ZZ'),
    search.replace('fixture', '%FF'),
    search.replace('fixture', ''),
    search + '&limit=0',
    search + '&page=0',
    search + '&type=private',
    '/api/music/lyric?source=netease',
    lyric + '&keyword=fixture',
    lyric.replace('fixture', ''),
    search + '&keyword=' + 'x'.repeat(8192),
    search + '\\',
    search + '\n',
  ])('rejects unreviewed raw target %#', (raw) => {
    expect(() => parseMappMetadataRequest(raw)).toThrow()
  })
  it('strict schemas also reject object-shaped unknown/array values', () => {
    for (const query of [
      { source: 'netease', keyword: 'fixture', userId: 'owner' },
      { source: 'netease', keyword: ['fixture', 'again'] },
    ])
      expect(mappMetadataSearchQuerySchema.safeParse(query).success).toBe(false)
    expect(
      mappMetadataLyricQuerySchema.safeParse({ source: 'netease', lyricId: 'fixture', url: 'https://evil.test' })
        .success,
    ).toBe(false)
  })
})
