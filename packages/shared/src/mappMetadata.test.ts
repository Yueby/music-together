import { describe, expect, it } from 'vitest'
import {
  MAPP_METADATA_MAX_BYTES,
  MAPP_METADATA_TARGETS,
  parseMappMetadataRequest,
  mappMetadataSearchQuerySchema,
  mappMetadataLyricQuerySchema,
} from './mappMetadata.js'

const search = '/api/music/search?source=netease&keyword=fixture'
const lyric = '/api/music/lyric?source=tencent&lyricId=fixture'
describe('reviewed metadata read contract', () => {
  it('publishes only search and lyric targets and a one MiB serialized limit', () => {
    expect(MAPP_METADATA_MAX_BYTES).toBe(1024 * 1024)
    expect(MAPP_METADATA_TARGETS).toEqual({
      search: {
        path: '/api/music/search',
        endpoint: 'musicSearch',
        queryKeys: ['source', 'keyword', 'limit', 'page', 'type'],
      },
      lyric: { path: '/api/music/lyric', endpoint: 'musicLyric', queryKeys: ['source', 'lyricId'] },
    })
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
    '/api/music/cover-proxy?url=https://evil.test',
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
