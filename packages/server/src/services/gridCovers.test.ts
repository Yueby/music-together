import type { Playlist } from '@music-together/shared'
import { describe, expect, it } from 'vitest'
import { GRID_COVER_SIZE, withGridCovers } from './gridCovers.js'

const list = (overrides: Partial<Playlist> = {}): Playlist => ({
  id: '1',
  name: 'List',
  cover: 'http://p1.music.126.net/a==/1.jpg',
  trackCount: 3,
  source: 'netease',
  ...overrides,
})

describe('withGridCovers', () => {
  it('serves NetEase artwork over https with a thumbnail sized for the grid', () => {
    const result = withGridCovers('netease', list())
    expect(result.cover).toBe('https://p1.music.126.net/a==/1.jpg')
    expect(result.thumbnailCover).toBe(`https://p1.music.126.net/a==/1.jpg?param=${GRID_COVER_SIZE}y${GRID_COVER_SIZE}`)
  })

  it('keeps the artwork other platforms return, only upgrading known CDNs to https', () => {
    const result = withGridCovers(
      'tencent',
      list({ source: 'tencent', cover: 'http://y.gtimg.cn/c.jpg', thumbnailCover: 'http://y.gtimg.cn/t.jpg' }),
    )
    expect(result.cover).toBe('https://y.gtimg.cn/c.jpg')
    expect(result.thumbnailCover).toBe('https://y.gtimg.cn/t.jpg')
  })

  it('adds no thumbnail where there is no artwork to resize', () => {
    expect(withGridCovers('netease', list({ cover: '' }))).not.toHaveProperty('thumbnailCover')
    expect(
      withGridCovers('kugou', list({ source: 'kugou', cover: 'https://imgessl.kugou.com/x.jpg' })),
    ).not.toHaveProperty('thumbnailCover')
  })

  it('leaves every other field alone', () => {
    expect(withGridCovers('netease', list({ creator: 'me', description: 'd' }))).toMatchObject({
      id: '1',
      name: 'List',
      trackCount: 3,
      creator: 'me',
      description: 'd',
    })
  })
})
