export const MAPP_METADATA_MAX_BYTES = 1024 * 1024
export const MAPP_METADATA_TARGETS = {
  search: {
    path: '/api/music/search',
    endpoint: 'musicSearch',
    queryKeys: ['source', 'keyword', 'limit', 'page', 'type'],
  },
  lyric: { path: '/api/music/lyric', endpoint: 'musicLyric', queryKeys: ['source', 'lyricId'] },
} as const
