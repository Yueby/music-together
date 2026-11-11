export const MAPP_METADATA_MAX_BYTES = 1024 * 1024
export const MAPP_METADATA_TARGETS = {
  search: {
    path: '/api/music/search',
    endpoint: 'musicSearch',
    queryKeys: ['source', 'keyword', 'limit', 'page', 'type'],
  },
  lyric: { path: '/api/music/lyric', endpoint: 'musicLyric', queryKeys: ['source', 'lyricId'] },
  /** Word-by-word TTML lyrics, served from the operator-configured TTML library. */
  ttml: { path: '/api/music/ttml', endpoint: 'musicTtml', queryKeys: ['source', 'id'] },
  /** Binary response (an image), unlike the JSON search/lyric targets. */
  cover: { path: '/api/music/cover-proxy', endpoint: 'musicCover', queryKeys: ['url'] },
  /** Artist home: profile plus the first page of songs and albums. */
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
  /** One page of a public playlist or album. */
  playlist: {
    path: '/api/music/playlist',
    endpoint: 'musicPlaylist',
    queryKeys: ['source', 'id', 'type', 'limit', 'offset', 'total'],
  },
  /** The radar playlists: the same list for everyone (their content is read through the playlist targets). */
  radar: { path: '/api/music/discover/radar', endpoint: 'musicRadar', queryKeys: ['source'] },
  /** Today's recommended songs of the caller: needs the verified identity and a room whose account pool holds the login. */
  daily: { path: '/api/music/discover/daily', endpoint: 'musicDaily', queryKeys: ['source', 'roomId'] },
  /** Recommended playlists (personal when signed in), recommended artists and new albums, in one answer. */
  home: { path: '/api/music/discover/home', endpoint: 'musicHome', queryKeys: ['source', 'roomId'] },
  /** One page of the caller's own playlist: needs the verified identity and a room whose account pool holds the login. */
  myPlaylist: {
    path: '/api/music/playlist/mine',
    endpoint: 'musicMyPlaylist',
    queryKeys: ['source', 'id', 'type', 'limit', 'offset', 'total', 'roomId'],
  },
} as const

/** Music CDNs the cover endpoint (Web and platform) may fetch from, and the mini-app may ask for. One list for both. */
export const COVER_HOST_ALLOWLIST: readonly string[] = [
  'y.gtimg.cn',
  'p1.music.126.net',
  'p2.music.126.net',
  'p3.music.126.net',
  'p4.music.126.net',
  'imgessl.kugou.com',
]

/** Platform cover responses are capped lower than the Web proxy: they are held in memory as Blob URLs. */
export const MAPP_COVER_MAX_BYTES = 2 * 1024 * 1024
