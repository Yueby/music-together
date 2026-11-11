import type { Track } from '@music-together/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { roomRepo } from '../repositories/roomRepository.js'
import type { RoomData } from '../repositories/types.js'
import { sanitizeIncomingTracks } from './incomingTracks.js'

function makeTrack(id: string, extra: Partial<Track> = {}): Track {
  return {
    id,
    title: `Track ${id}`,
    artist: ['Artist'],
    album: 'Album',
    duration: 180,
    cover: 'https://p1.music.126.net/c.jpg',
    source: 'netease',
    sourceId: id,
    urlId: id,
    ...extra,
  }
}

function room(queue: Track[], currentTrack: Track | null = null) {
  roomRepo.set('ROOM01', { id: 'ROOM01', queue, currentTrack, pendingPlayback: null } as unknown as RoomData)
}

afterEach(() => roomRepo.delete('ROOM01'))

describe('sanitizeIncomingTracks', () => {
  it('drops a stream address that came with the track: only the server resolves those', () => {
    room([])
    const [track] = sanitizeIncomingTracks('ROOM01', [makeTrack('a', { streamUrl: 'https://evil.test/a.mp3' })], 'Me')
    expect(track.streamUrl).toBeUndefined()
    expect('streamUrl' in track).toBe(false)
  })

  it('records who asked for it', () => {
    room([])
    expect(sanitizeIncomingTracks('ROOM01', [makeTrack('a')], 'Me')[0].requestedBy).toBe('Me')
  })

  it('keeps https artwork, upgrades a known CDN, and drops anything else', () => {
    room([])
    const [https, http, other, script] = sanitizeIncomingTracks(
      'ROOM01',
      [
        makeTrack('1', { cover: 'https://y.gtimg.cn/a.jpg' }),
        makeTrack('2', { cover: 'http://p3.music.126.net/b.jpg' }),
        makeTrack('3', { cover: 'http://evil.test/c.jpg' }),
        makeTrack('4', { cover: 'javascript:alert(1)', thumbnailCover: 'data:text/html,x' }),
      ],
      'Me',
    )
    expect(https.cover).toBe('https://y.gtimg.cn/a.jpg')
    expect(http.cover).toBe('https://p3.music.126.net/b.jpg')
    expect(other.cover).toBe('')
    expect(script.cover).toBe('')
    expect(script.thumbnailCover).toBe('')
  })

  it('keeps an id that is free', () => {
    room([makeTrack('x')])
    expect(sanitizeIncomingTracks('ROOM01', [makeTrack('a')], 'Me')[0].id).toBe('a')
  })

  it('gives a track whose id the queue already holds a new one', () => {
    room([makeTrack('a')], makeTrack('a'))
    const [again] = sanitizeIncomingTracks('ROOM01', [makeTrack('a')], 'Me')
    expect(again.id).not.toBe('a')
    expect(again.sourceId).toBe('a')
  })

  it('does not let one batch hold an id twice', () => {
    room([])
    const ids = sanitizeIncomingTracks('ROOM01', [makeTrack('a'), makeTrack('a'), makeTrack('a')], 'Me').map(
      (t) => t.id,
    )
    expect(new Set(ids).size).toBe(3)
    expect(ids[0]).toBe('a')
  })

  it('works for a room that is gone, still cleaning the track', () => {
    const [track] = sanitizeIncomingTracks('NOPE', [makeTrack('a', { streamUrl: 'https://evil.test/a.mp3' })], 'Me')
    expect(track.streamUrl).toBeUndefined()
  })
})
