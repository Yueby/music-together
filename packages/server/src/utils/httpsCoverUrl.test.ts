import { describe, expect, it } from 'vitest'
import { httpsCoverUrl } from './httpsCoverUrl.js'

describe('httpsCoverUrl', () => {
  it.each([
    ['http://p1.music.126.net/a==/1.jpg', 'https://p1.music.126.net/a==/1.jpg'],
    ['http://p4.music.126.net/a.jpg?param=120y120', 'https://p4.music.126.net/a.jpg?param=120y120'],
    ['http://y.gtimg.cn/music/photo_new/T002R300x300M000x.jpg', 'https://y.gtimg.cn/music/photo_new/T002R300x300M000x.jpg'],
  ])('upgrades a known music CDN: %s', (input, expected) => {
    expect(httpsCoverUrl(input)).toBe(expected)
  })

  it.each([
    'https://p1.music.126.net/a.jpg',
    'http://example.test/cover.jpg',
    'http://p1.music.126.net.evil.test/a.jpg',
    'http://evil.test/p1.music.126.net/a.jpg',
    '',
    'not a url',
    '//p1.music.126.net/a.jpg',
  ])('leaves %j untouched', (input) => {
    expect(httpsCoverUrl(input)).toBe(input)
  })
})
