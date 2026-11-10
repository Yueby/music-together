export const MAPP_METADATA_MAX_BYTES = 1024 * 1024
export const MAPP_METADATA_TARGETS = {
  search: {
    path: '/api/music/search',
    endpoint: 'musicSearch',
    queryKeys: ['source', 'keyword', 'limit', 'page', 'type'],
  },
  lyric: { path: '/api/music/lyric', endpoint: 'musicLyric', queryKeys: ['source', 'lyricId'] },
  /** Binary response (an image), unlike the JSON search/lyric targets. */
  cover: { path: '/api/music/cover-proxy', endpoint: 'musicCover', queryKeys: ['url'] },
} as const

/** Platform cover responses are capped lower than the Web proxy: they are held in memory as Blob URLs. */
export const MAPP_COVER_MAX_BYTES = 2 * 1024 * 1024
