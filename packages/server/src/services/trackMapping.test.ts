import { describe, expect, it } from 'vitest'
import { kugouSongToTrack, navigatePath, rawToTrack, rawToTrackOrNull } from './trackMapping.js'

describe('navigatePath', () => {
  it('follows a dotted path, numeric steps included, and gives undefined where it breaks', () => {
    const data = { data: { cdlist: [{ songlist: ['a', 'b'] }] } }
    expect(navigatePath(data, 'data.cdlist.0.songlist')).toEqual(['a', 'b'])
    expect(navigatePath(data, 'data.nothing.deeper')).toBeUndefined()
  })
})

describe('rawToTrack', () => {
  it('maps a NetEase song, with VIP from the fee and the duration in seconds', () => {
    const track = rawToTrack(
      { id: 5, name: 'N', ar: [{ id: 1, name: 'A' }], al: { name: 'Al', pic_str: '99' }, dt: 215_400, fee: 4 },
      'netease',
    )
    expect(track).toMatchObject({
      title: 'N',
      artist: ['A'],
      artistIds: ['1'],
      album: 'Al',
      duration: 215,
      source: 'netease',
      sourceId: '5',
      urlId: '5',
      lyricId: '5',
      picId: '99',
      vip: true,
    })
  })

  it('maps a Tencent song, also when it is wrapped in musicData', () => {
    const wrapped = rawToTrack(
      {
        musicData: {
          name: 'T',
          mid: 'm1',
          singer: [{ name: 'S1' }, { name: 'S2' }],
          album: { title: ' Al ', mid: 'am' },
          interval: 180,
          pay: { pay_month: 1 },
        },
      },
      'tencent',
    )
    expect(wrapped).toMatchObject({
      title: 'T',
      artist: ['S1', 'S2'],
      album: 'Al',
      duration: 180,
      sourceId: 'm1',
      picId: 'am',
      vip: true,
    })
    expect(rawToTrack({ name: 'F', mid: 'm2', singer: [] }, 'tencent').vip).toBe(false)
  })

  it('splits a Kugou filename into artists and title, and reads VIP from the privilege bits or the pay type', () => {
    const track = rawToTrack({ filename: 'A、B - Some - Title', hash: 'h', duration: 200, privilege: 8 }, 'kugou')
    expect(track).toMatchObject({ title: 'Some - Title', artist: ['A', 'B'], sourceId: 'h', duration: 200, vip: true })
    expect(rawToTrack({ filename: 'x', hash: 'h2', pay_type: 3 }, 'kugou').vip).toBe(true)
    expect(rawToTrack({ filename: 'x', hash: 'h3' }, 'kugou').vip).toBe(false)
  })

  it('says "nobody credited" in one place when a platform names no artist', () => {
    expect(rawToTrack({ id: 1, name: 'N' }, 'netease').artist).toEqual(['Unknown'])
    expect(rawToTrack({ filename: 'Only Title', hash: 'h' }, 'kugou').artist).toEqual(['Unknown'])
    // QQ too: an empty or nameless singer list is not an (truthy) empty array of artists.
    expect(rawToTrack({ mid: 'm', singer: [] }, 'tencent').artist).toEqual(['Unknown'])
    expect(rawToTrack({ mid: 'm' }, 'tencent').artist).toEqual(['Unknown'])
    expect(rawToTrack({ mid: 'm', singer: [{ name: '' }, { id: 1 }] }, 'tencent').artist).toEqual(['Unknown'])
    expect(rawToTrack({ mid: 'm', singer: [{ name: 'S1' }, { name: '' }] }, 'tencent').artist).toEqual(['S1'])
  })

  it('rawToTrackOrNull drops a song without its platform id, instead of an id of "undefined"', () => {
    expect(rawToTrackOrNull({ name: 'T', singer: [] }, 'tencent')).toBeNull()
    expect(rawToTrackOrNull({ musicData: { name: 'T', mid: '' } }, 'tencent')).toBeNull()
    expect(rawToTrackOrNull({ filename: 'A - T' }, 'kugou')).toBeNull()
    expect(rawToTrackOrNull({ name: 'T' }, 'netease')).toBeNull()
    expect(rawToTrackOrNull({ musicData: { name: 'T', mid: 'm9' } }, 'tencent')).toMatchObject({ sourceId: 'm9' })
    expect(rawToTrackOrNull({ filename: 'A - T', hash: 'h' }, 'kugou')).toMatchObject({ sourceId: 'h' })
    expect(rawToTrackOrNull({ id: 0, name: 'T' }, 'netease')).toMatchObject({ sourceId: '0' })
  })

  it('gives every track its own local id', () => {
    const a = rawToTrack({ id: 1 }, 'netease')
    const b = rawToTrack({ id: 1 }, 'netease')
    expect(a.id).not.toBe(b.id)
  })
})

describe('kugouSongToTrack', () => {
  it('maps a playlist entry and turns a millisecond duration into seconds', () => {
    const track = kugouSongToTrack({
      hash: 'h',
      filename: 'A, B - T',
      duration: 240_000,
      album_name: 'Al',
      privilege: 1,
    })
    expect(track).toMatchObject({ title: 'T', artist: ['A', 'B'], duration: 240, album: 'Al', vip: true, picId: 'h' })
  })

  it('finds the hash in nested audio info, falls back to the name, and skips an entry without a hash', () => {
    expect(kugouSongToTrack({ audio_info: { hash: 'nested' }, name: 'Solo' })).toMatchObject({
      sourceId: 'nested',
      title: 'Solo',
      artist: [],
    })
    expect(kugouSongToTrack({ filename: 'A - T' })).toBeNull()
  })
})
