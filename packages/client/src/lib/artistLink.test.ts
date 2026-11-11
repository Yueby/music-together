import { describe, expect, it } from 'vitest'
import { hasArtistPages, trackArtists } from './artistLink'

describe('hasArtistPages', () => {
  it('is true only where the platform has artist pages', () => {
    expect(hasArtistPages('netease')).toBe(true)
    expect(hasArtistPages('tencent')).toBe(false)
    expect(hasArtistPages('kugou')).toBe(false)
  })
})

describe('trackArtists', () => {
  it('pairs every credited name with its platform id', () => {
    expect(trackArtists({ source: 'netease', artist: ['A', 'B'], artistIds: ['1', '2'] })).toEqual([
      { source: 'netease', name: 'A', id: '1' },
      { source: 'netease', name: 'B', id: '2' },
    ])
  })

  it('leaves the id out when the track has none, so the artist is found by name', () => {
    expect(trackArtists({ source: 'netease', artist: ['A'] })).toEqual([{ source: 'netease', name: 'A' }])
  })

  it('does not trust ids that do not line up with the names', () => {
    expect(trackArtists({ source: 'netease', artist: ['A', 'B'], artistIds: ['1'] })).toEqual([
      { source: 'netease', name: 'A' },
      { source: 'netease', name: 'B' },
    ])
  })
})
