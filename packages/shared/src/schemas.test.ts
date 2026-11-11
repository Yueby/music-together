import { describe, expect, it } from 'vitest'
import { LIMITS } from './constants.js'
import {
  coverQuerySchema,
  ntpPingSchema,
  playerPlaySchema,
  queueAddBatchSchema,
  roomCreateSchema,
  roomJoinSchema,
  roomSettingsSchema,
  searchQuerySchema,
  urlQuerySchema,
  voteStartSchema,
} from './schemas.js'

const track = {
  id: 'track-1',
  title: 'Blank Space',
  artist: ['Taylor Swift'],
  album: '1989',
  duration: 231,
  cover: '',
  source: 'tencent' as const,
  sourceId: '003VHaBb0wCHop',
  urlId: '003VHaBb0wCHop',
}

describe('shared schemas', () => {
  it('rejects empty nicknames and oversized room names', () => {
    expect(roomCreateSchema.safeParse({ nickname: '' }).success).toBe(false)
    expect(
      roomCreateSchema.safeParse({
        nickname: 'listener',
        roomName: 'x'.repeat(LIMITS.ROOM_NAME_MAX_LENGTH + 1),
      }).success,
    ).toBe(false)
  })

  it('applies the nickname limit consistently when joining', () => {
    expect(roomJoinSchema.safeParse({ roomId: 'ROOM01', nickname: 'listener' }).success).toBe(true)
    expect(
      roomJoinSchema.safeParse({
        roomId: 'ROOM01',
        nickname: 'x'.repeat(LIMITS.NICKNAME_MAX_LENGTH + 1),
      }).success,
    ).toBe(false)
  })

  it('does not accept a nickname of only blanks, and trims the rest', () => {
    expect(roomCreateSchema.safeParse({ nickname: '   ' }).success).toBe(false)
    expect(roomJoinSchema.safeParse({ roomId: 'ROOM01', nickname: '   ' }).success).toBe(false)
    expect(roomJoinSchema.parse({ roomId: 'ROOM01', nickname: '  me  ' }).nickname).toBe('me')
  })

  it('keeps the thumbnail of a queued track', () => {
    const parsed = queueAddBatchSchema.parse({ tracks: [{ ...track, thumbnailCover: 'https://x.test/t.jpg' }] })
    expect(parsed.tracks[0].thumbnailCover).toBe('https://x.test/t.jpg')
  })

  it('refuses a queued track without an id', () => {
    expect(queueAddBatchSchema.safeParse({ tracks: [{ ...track, id: '' }] }).success).toBe(false)
  })

  it('sets a room password only when there is one: null removes it, an empty string is refused', () => {
    expect(roomSettingsSchema.safeParse({ password: 'secret' }).success).toBe(true)
    expect(roomSettingsSchema.safeParse({ password: null }).success).toBe(true)
    expect(roomSettingsSchema.safeParse({ password: '' }).success).toBe(false)
    expect(roomSettingsSchema.safeParse({ name: '   ' }).success).toBe(false)
  })

  it('takes the RTT of a ping only when a connection could really have measured it', () => {
    expect(ntpPingSchema.parse({ clientPingId: 3, lastRttMs: 85.5 })).toEqual({ clientPingId: 3, lastRttMs: 85.5 })
    expect(ntpPingSchema.parse({ clientPingId: 3 }).lastRttMs).toBeUndefined()
    // an absurd or malformed RTT is dropped, the ping (and its id, which is echoed) stays
    for (const lastRttMs of [-1, 0, 10_001, Number.NaN, '50', null]) {
      const parsed = ntpPingSchema.safeParse({ clientPingId: 3, lastRttMs })
      expect(parsed.success).toBe(true)
      expect(parsed.success && parsed.data.lastRttMs).toBeUndefined()
    }
    expect(ntpPingSchema.safeParse({ clientPingId: 'x' }).success).toBe(false)
    expect(ntpPingSchema.safeParse(undefined).success).toBe(false)
  })

  it('plays a requested track by its id alone', () => {
    expect(playerPlaySchema.safeParse(undefined).success).toBe(true)
    expect(playerPlaySchema.safeParse({}).success).toBe(true)
    expect(playerPlaySchema.parse({ track: { id: 'a', streamUrl: 'https://evil.test/a.mp3' } })).toEqual({
      track: { id: 'a' },
    })
    expect(playerPlaySchema.safeParse({ track: {} }).success).toBe(false)
    expect(playerPlaySchema.safeParse({ track: { id: '' } }).success).toBe(false)
  })

  it('validates vote payloads by action', () => {
    expect(voteStartSchema.safeParse({ action: 'pause' }).success).toBe(true)
    expect(voteStartSchema.safeParse({ action: 'set-mode', payload: {} }).success).toBe(false)
    expect(voteStartSchema.safeParse({ action: 'set-mode', payload: { mode: 'shuffle' } }).success).toBe(true)
    expect(voteStartSchema.safeParse({ action: 'play-track', payload: { trackId: '' } }).success).toBe(false)
  })

  it('keeps the title of the track a vote is about, for the vote banner', () => {
    const play = voteStartSchema.parse({ action: 'play-track', payload: { trackId: 'a', trackTitle: 'Song' } })
    expect(play.payload).toEqual({ trackId: 'a', trackTitle: 'Song' })
    const remove = voteStartSchema.parse({ action: 'remove-track', payload: { trackId: 'a', trackTitle: 'Song' } })
    expect(remove.payload).toEqual({ trackId: 'a', trackTitle: 'Song' })
  })

  it('bounds music resource IDs and numeric options', () => {
    expect(urlQuerySchema.safeParse({ source: 'netease', urlId: 'id', bitrate: 320 }).success).toBe(true)
    expect(urlQuerySchema.safeParse({ source: 'netease', urlId: 'x'.repeat(201), bitrate: 320 }).success).toBe(false)
    expect(coverQuerySchema.safeParse({ source: 'netease', picId: 'id', size: 5000 }).success).toBe(false)
  })

  it('coerces valid search pagination and rejects values outside limits', () => {
    const parsed = searchQuerySchema.parse({
      source: 'tencent',
      keyword: 'blank space',
      limit: '20',
      page: '2',
    })

    expect(parsed).toMatchObject({ limit: 20, page: 2, type: 'song' })
    expect(
      searchQuerySchema.safeParse({
        source: 'tencent',
        keyword: 'blank space',
        limit: LIMITS.SEARCH_PAGE_SIZE_MAX + 1,
      }).success,
    ).toBe(false)
  })

  it('enforces queue batch size limits', () => {
    expect(queueAddBatchSchema.safeParse({ tracks: [] }).success).toBe(false)
    expect(queueAddBatchSchema.safeParse({ tracks: [track] }).success).toBe(true)
    expect(
      queueAddBatchSchema.safeParse({
        tracks: Array.from({ length: LIMITS.QUEUE_BATCH_MAX_SIZE + 1 }, (_, i) => ({
          ...track,
          id: `track-${i}`,
        })),
      }).success,
    ).toBe(false)
  })
})
