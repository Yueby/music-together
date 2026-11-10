import { describe, expect, it } from 'vitest'
import {
  MAPP_COVER_MAX_BYTES,
  MAPP_METADATA_MAX_BYTES,
  MAPP_METADATA_SCHEMAS,
  MAPP_METADATA_TARGETS,
  parseMappMetadataRequest,
  mappMetadataSearchQuerySchema,
  mappMetadataLyricQuerySchema,
} from './mappMetadata.js'

const search = '/api/music/search?source=netease&keyword=fixture'
const lyric = '/api/music/lyric?source=tencent&lyricId=fixture'
describe('reviewed metadata read contract', () => {
  it('publishes only the reviewed targets, a one MiB JSON limit and a two MiB cover limit', () => {
    expect(MAPP_METADATA_MAX_BYTES).toBe(1024 * 1024)
    expect(MAPP_COVER_MAX_BYTES).toBe(2 * 1024 * 1024)
    expect(MAPP_METADATA_TARGETS).toEqual({
      search: {
        path: '/api/music/search',
        endpoint: 'musicSearch',
        queryKeys: ['source', 'keyword', 'limit', 'page', 'type'],
      },
      lyric: { path: '/api/music/lyric', endpoint: 'musicLyric', queryKeys: ['source', 'lyricId'] },
      ttml: { path: '/api/music/ttml', endpoint: 'musicTtml', queryKeys: ['source', 'id'] },
      cover: { path: '/api/music/cover-proxy', endpoint: 'musicCover', queryKeys: ['url'] },
      artist: { path: '/api/music/artist', endpoint: 'musicArtist', queryKeys: ['source', 'id'] },
      artistSongs: {
        path: '/api/music/artist/songs',
        endpoint: 'musicArtistSongs',
        queryKeys: ['source', 'id', 'offset', 'limit'],
      },
      artistAlbums: {
        path: '/api/music/artist/albums',
        endpoint: 'musicArtistAlbums',
        queryKeys: ['source', 'id', 'offset', 'limit'],
      },
      playlist: {
        path: '/api/music/playlist',
        endpoint: 'musicPlaylist',
        queryKeys: ['source', 'id', 'type', 'limit', 'offset', 'total'],
      },
      myPlaylist: {
        path: '/api/music/playlist/mine',
        endpoint: 'musicMyPlaylist',
        queryKeys: ['source', 'id', 'type', 'limit', 'offset', 'total', 'roomId'],
      },
    })
  })

  it('keeps every target\'s declared query keys identical to its schema (the JWT and manifest depend on them)', () => {
    for (const [kind, target] of Object.entries(MAPP_METADATA_TARGETS)) {
      const schema = MAPP_METADATA_SCHEMAS[kind as keyof typeof MAPP_METADATA_SCHEMAS] as unknown as {
        shape: Record<string, unknown>
      }
      expect([...target.queryKeys].sort(), kind).toEqual(Object.keys(schema.shape).sort())
    }
    // Endpoint names and paths are unique, or one declaration would shadow another.
    const targets = Object.values(MAPP_METADATA_TARGETS)
    expect(new Set(targets.map((target) => target.endpoint)).size).toBe(targets.length)
    expect(new Set(targets.map((target) => target.path)).size).toBe(targets.length)
  })

  it.each([
    ['/api/music/artist?source=netease&id=3684', 'artist', { source: 'netease', id: '3684' }],
    [
      '/api/music/artist/songs?source=netease&id=3684',
      'artistSongs',
      { source: 'netease', id: '3684', offset: 0, limit: 30 },
    ],
    [
      '/api/music/artist/albums?source=netease&id=3684&offset=30&limit=30',
      'artistAlbums',
      { source: 'netease', id: '3684', offset: 30, limit: 30 },
    ],
    [
      '/api/music/playlist?source=tencent&id=abc&type=album',
      'playlist',
      { source: 'tencent', id: 'abc', type: 'album', limit: 100, offset: 0, total: 0 },
    ],
    [
      '/api/music/playlist/mine?source=kugou&id=9&roomId=ROOM01',
      'myPlaylist',
      { source: 'kugou', id: '9', roomId: 'ROOM01', type: 'playlist', limit: 100, offset: 0, total: 0 },
    ],
  ])('parses %s with every key present, defaults included', (raw, kind, query) => {
    expect(parseMappMetadataRequest(raw)).toMatchObject({ kind, query })
  })

  it.each([
    '/api/music/artist?source=netease',
    '/api/music/artist?source=netease&id=1&extra=1',
    '/api/music/artist?source=netease&id=a%2Fb',
    '/api/music/artist/songs?source=netease&id=1&limit=51',
    '/api/music/playlist?source=netease&id=1&limit=201',
    '/api/music/playlist?source=netease&id=1&roomId=ABC123',
    '/api/music/playlist?source=netease&id=1&type=artist',
    '/api/music/playlist/mine?source=netease&id=1',
    '/api/music/playlist/mine?source=netease&id=1&roomId=ABC123&userId=mapp_x',
  ])('rejects %s', (raw) => {
    expect(() => parseMappMetadataRequest(raw)).toThrow()
  })

  it('reports a malformed escape as a rejected query, not a stray URIError', () => {
    // %C3 alone is a valid-looking escape whose UTF-8 sequence is incomplete.
    expect(() => parseMappMetadataRequest('/api/music/search?source=netease&keyword=%C3')).toThrow(
      'METADATA_QUERY_REJECTED',
    )
  })
  it.each(['netease', 'tencent'])('accepts a TTML request for %s with a plain song id', (source) => {
    expect(parseMappMetadataRequest(`/api/music/ttml?source=${source}&id=Ab_12-3`)).toMatchObject({
      kind: 'ttml',
      query: { source, id: 'Ab_12-3' },
    })
  })
  it.each([
    '/api/music/ttml',
    '/api/music/ttml?source=kugou&id=1',
    '/api/music/ttml?source=netease',
    '/api/music/ttml?source=netease&id=',
    '/api/music/ttml?source=netease&id=../etc',
    '/api/music/ttml?source=netease&id=1%2F..%2F2',
    '/api/music/ttml?source=netease&id=1.ttml',
    '/api/music/ttml?source=netease&id=' + '1'.repeat(65),
    '/api/music/ttml?source=netease&id=1&id=2',
    '/api/music/ttml?source=netease&id=1&url=https://evil.test/x.ttml',
    '/api/music/ttml?source=netease&id=1&roomId=ABC123',
    '/api/music/ttml/?source=netease&id=1',
  ])('rejects unreviewed TTML target %#', (raw) => {
    expect(() => parseMappMetadataRequest(raw)).toThrow()
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
    '/api/music/playlist/extra?source=netease&id=fixture',
    '/api/music/artist/popular?source=netease&id=1',
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
