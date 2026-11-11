import { describe, expect, it } from 'vitest'
import { looksLikeMusicId, normalizeMusicId, parseMusicLink, supportsIdLookup } from './musicRef.js'

describe('parseMusicLink', () => {
  it.each([
    ['https://music.163.com/#/song?id=1901371647', 'song', '1901371647'],
    ['https://music.163.com/song?id=1901371647&uct2=abc', 'song', '1901371647'],
    ['https://y.music.163.com/m/playlist?id=3778678&app_version=9', 'playlist', '3778678'],
    ['https://music.163.com/#/album?id=34209', 'album', '34209'],
    ['https://music.163.com/playlist/3778678', 'playlist', '3778678'],
    ['https://music.163.com/#/artist?id=11127', 'artist', '11127'],
  ])('reads the NetEase link %s', (link, kind, id) => {
    expect(parseMusicLink(link)).toEqual({ source: 'netease', kind, id })
  })

  it.each([
    ['https://y.qq.com/n/ryqq/songDetail/003VHaBb0wCHop', 'song', '003VHaBb0wCHop'],
    ['https://y.qq.com/n/yqq/song/003VHaBb0wCHop.html', 'song', '003VHaBb0wCHop'],
    ['https://y.qq.com/n/ryqq/albumDetail/000MkMni19ClKG', 'album', '000MkMni19ClKG'],
    ['https://y.qq.com/n/ryqq/playlist/7256912512', 'playlist', '7256912512'],
    ['https://i.y.qq.com/v8/playsquare/playlist.html?id=7256912512&source=share', 'playlist', '7256912512'],
    ['https://i.y.qq.com/v8/playsquare/songDetail.html?songmid=003VHaBb0wCHop', 'song', '003VHaBb0wCHop'],
  ])('reads the QQ Music link %s', (link, kind, id) => {
    expect(parseMusicLink(link)).toEqual({ source: 'tencent', kind, id })
  })

  it.each([
    [
      'https://www.kugou.com/song/#hash=E12192D7B0A3E370BB2B5A4BCBB8F4C2&album_id=1645030',
      'song',
      'E12192D7B0A3E370BB2B5A4BCBB8F4C2',
    ],
    [
      'https://m.kugou.com/song/index.html?hash=E12192D7B0A3E370BB2B5A4BCBB8F4C2',
      'song',
      'E12192D7B0A3E370BB2B5A4BCBB8F4C2',
    ],
    ['https://www.kugou.com/yy/album/single/1645030.html', 'album', '1645030'],
    ['https://www.kugou.com/yy/special/single/545990.html', 'playlist', '545990'],
    ['https://m.kugou.com/plist/list/545990', 'playlist', '545990'],
  ])('reads the Kugou link %s', (link, kind, id) => {
    expect(parseMusicLink(link)).toEqual({ source: 'kugou', kind, id })
  })

  it('finds the link inside a share message', () => {
    expect(
      parseMusicLink('分享歌单《热歌榜》: https://music.163.com/playlist?id=3778678&userid=1 (来自网易云音乐)'),
    ).toEqual({
      source: 'netease',
      kind: 'playlist',
      id: '3778678',
    })
  })

  it.each([
    'hello',
    '1901371647',
    'https://example.com/song?id=1',
    'https://music.163.com/',
    'https://music.163.com/song?id=abc',
    'https://evil.test/?u=https://music.163.com/song?id=1',
    'https://y.qq.com/n/ryqq/songDetail/short',
    'https://www.kugou.com/song/#hash=nothex',
  ])('does not read %s', (input) => {
    expect(parseMusicLink(input)).toBeNull()
  })

  it('does not trust a platform name that only appears in the path or as a lookalike host', () => {
    expect(parseMusicLink('https://music.163.com.evil.test/song?id=1')).toBeNull()
    expect(parseMusicLink('https://evil.test/music.163.com/song?id=1')).toBeNull()
  })
})

describe('normalizeMusicId', () => {
  it('accepts a plain id of the right shape, trimmed', () => {
    expect(normalizeMusicId('netease', 'song', ' 1901371647 ')).toBe('1901371647')
    expect(normalizeMusicId('tencent', 'song', '003VHaBb0wCHop')).toBe('003VHaBb0wCHop')
    expect(normalizeMusicId('tencent', 'album', '8220')).toBe('8220')
    expect(normalizeMusicId('kugou', 'song', 'e12192d7b0a3e370bb2b5a4bcbb8f4c2')).toBe(
      'e12192d7b0a3e370bb2b5a4bcbb8f4c2',
    )
    expect(normalizeMusicId('kugou', 'playlist', 'collection_3_1_2_3')).toBe('collection_3_1_2_3')
  })

  it.each([
    ['netease', 'song', '12 34'],
    ['netease', 'song', '12abc'],
    ['netease', 'album', '../../etc'],
    ['tencent', 'song', '12345'],
    ['tencent', 'playlist', '003VHaBb0wCHop'],
    ['kugou', 'song', '123456'],
    ['kugou', 'album', 'E12192D7B0A3E370BB2B5A4BCBB8F4C2'],
    ['netease', 'song', ''],
    ['netease', 'song', '9'.repeat(21)],
  ] as const)('rejects %s %s "%s"', (source, kind, input) => {
    expect(normalizeMusicId(source, kind, input)).toBeNull()
  })

  it('takes the id out of a link of the same platform and kind', () => {
    expect(normalizeMusicId('netease', 'playlist', 'https://music.163.com/playlist?id=3778678')).toBe('3778678')
    expect(normalizeMusicId('tencent', 'song', 'https://y.qq.com/n/ryqq/songDetail/003VHaBb0wCHop')).toBe(
      '003VHaBb0wCHop',
    )
  })

  it('does not guess when the link is for another platform or kind', () => {
    expect(normalizeMusicId('tencent', 'playlist', 'https://music.163.com/playlist?id=3778678')).toBeNull()
    expect(normalizeMusicId('netease', 'song', 'https://music.163.com/playlist?id=3778678')).toBeNull()
  })
})

describe('looksLikeMusicId', () => {
  it.each([
    ['netease', 'playlist', '3778678'],
    ['netease', 'song', '1901371647'],
    ['tencent', 'song', '003VHaBb0wCHop'],
    ['tencent', 'playlist', '7256912512'],
    ['kugou', 'song', 'E12192D7B0A3E370BB2B5A4BCBB8F4C2'],
    ['kugou', 'playlist', 'collection_3_1_2_3'],
    ['netease', 'playlist', 'https://music.163.com/playlist?id=12'],
  ] as const)('takes %s %s "%s" for an id', (source, kind, input) => {
    expect(looksLikeMusicId(source, kind, input)).toBe(true)
  })

  it.each([
    ['netease', 'artist', '1975'],
    ['netease', 'song', '2000'],
    ['netease', 'song', '12345'],
    ['netease', 'song', '周杰伦'],
    ['netease', 'song', 'hello world'],
    ['tencent', 'song', 'abcdefghijklmn'],
    ['tencent', 'album', 'abcdefghijklmn'],
    ['kugou', 'song', 'not a hash'],
    ['netease', 'song', 'https://y.qq.com/n/ryqq/songDetail/003VHaBb0wCHop'],
  ] as const)('leaves %s %s "%s" as words', (source, kind, input) => {
    expect(looksLikeMusicId(source, kind, input)).toBe(false)
  })
})

describe('supportsIdLookup', () => {
  it('has artist pages for NetEase only, everything else everywhere', () => {
    expect(supportsIdLookup('netease', 'artist')).toBe(true)
    expect(supportsIdLookup('tencent', 'artist')).toBe(false)
    expect(supportsIdLookup('kugou', 'artist')).toBe(false)
    expect(supportsIdLookup('kugou', 'playlist')).toBe(true)
  })
})
