import { EVENTS, TIMING, type Track } from '@music-together/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { roomRepo } from '../repositories/roomRepository.js'
import { toPublicRoomState } from '../utils/roomUtils.js'
import type { RoomData } from '../repositories/types.js'
import { musicProvider } from './musicProvider.js'
import * as authService from './authService.js'
import { config } from '../config.js'
import { clearAllTimers } from './roomLifecycleService.js'
import { joinRoom, leaveRoom } from './roomService.js'
import {
  autoPlayIfEmpty,
  cleanupRoom,
  markClientReady,
  pauseTrack,
  playNextTrackInRoom,
  preloadUpcoming,
  playTrackInRoom,
  playPrevTrackInRoom,
  resumeTrack,
  seekTrack,
  setCurrentTrack,
  stopPlayback,
  stopPlaybackSafe,
  syncPlaybackToSocket,
} from './playerService.js'

const track: Track = {
  id: 'track-1',
  title: 'Song',
  artist: ['Artist'],
  album: 'Album',
  duration: 180,
  cover: '',
  source: 'netease',
  sourceId: 'track-1',
  urlId: 'track-1',
  streamUrl: 'https://m801.music.126.net/20990101080000/signature/song.mp3',
}

function room(): RoomData {
  return {
    id: 'ROOM01',
    name: 'Room',
    password: null,
    creatorId: 'owner',
    hostId: 'owner',
    conductorSocketId: 'socket-owner',
    adminUserIds: new Set(),
    temporaryAdminUserId: null,
    audioQuality: 320,
    users: [{ id: 'owner', nickname: 'Owner', role: 'owner' }],
    queue: [track],
    currentTrack: track,
    playState: { isPlaying: true, currentTime: 10, serverTimestamp: Date.now(), revision: 0 },
    pendingPlayback: null,
    playMode: 'loop-all',
    queueMode: 'keep',
  }
}

function ioMock() {
  const emit = vi.fn()
  return {
    emit,
    io: { to: vi.fn(() => ({ emit })) },
  }
}

afterEach(() => {
  cleanupRoom('ROOM01')
  roomRepo.delete('ROOM01')
  roomRepo.deleteSocketMapping('socket')
  roomRepo.deleteSocketMapping('socket-owner')
  roomRepo.deleteSocketMapping('socket-guest')
  roomRepo.deleteSocketMapping('late-joiner')
  clearAllTimers()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('playerService state transitions', () => {
  it('schedules playback at an integer millisecond with a fractional P90 RTT', () => {
    vi.useFakeTimers()
    const data = room()
    roomRepo.set(data.id, data)
    vi.spyOn(roomRepo, 'getP90RTT').mockReturnValue(187.3)
    const { io, emit } = ioMock()
    const scheduledAt = Date.now() + 381

    pauseTrack(io as never, data.id)

    expect(data.pendingPlayback?.playState.serverTimestamp).toBe(scheduledAt)
    expect(emit).toHaveBeenCalledWith(EVENTS.PLAYER_PAUSE, {
      playState: expect.objectContaining({ serverTimeToExecute: scheduledAt }),
    })
  })

  it('uses the replacement metadata in the queue and playback after automatic fallback', async () => {
    vi.useFakeTimers()
    const data = room()
    const original = {
      ...track,
      streamUrl: undefined,
      artistIds: ['original-artist'],
      thumbnailCover: 'https://example.com/original.jpg',
    }
    const replacement: Track = {
      ...track,
      id: 'replacement',
      source: 'tencent',
      sourceId: 'replacement',
      urlId: 'replacement',
      duration: 184,
      artistIds: ['replacement-artist'],
      thumbnailCover: 'https://example.com/replacement.jpg',
    }
    data.queue = [original]
    roomRepo.set(data.id, data)
    vi.spyOn(authService, 'getAnyCookie').mockImplementation((source) => source === 'tencent' ? 'fixture-cookie' : null)
    vi.spyOn(musicProvider, 'search').mockResolvedValue([replacement])
    vi.spyOn(musicProvider, 'getStreamUrl').mockImplementation(async (source) =>
      source === 'tencent' ? 'https://example.com/replacement.mp3' : null,
    )
    const { io, emit } = ioMock()

    const wasEnabled = config.autoFallback.enabled
    config.autoFallback.enabled = true
    try {
      expect(await playTrackInRoom(io as never, data.id, original)).toBe(true)
    } finally {
      config.autoFallback.enabled = wasEnabled
    }
    const queued = { ...replacement, id: original.id, streamUrl: 'https://example.com/replacement.mp3' }
    expect(data.queue).toEqual([queued])
    expect(emit).toHaveBeenCalledWith(EVENTS.PLAYER_PLAY, { track: queued, playState: expect.anything() })
    await vi.advanceTimersByTimeAsync(2_000)
    expect(data.currentTrack).toEqual(queued)
  })

  it.each([
    { vip: true, currentCookie: 'non-vip-cookie', targetCookie: 'other-platform-cookie' },
    { vip: false, currentCookie: null, targetCookie: null },
  ])('removes an unavailable song when automatic fallback is inapplicable (%j)', async ({
    vip, currentCookie, targetCookie,
  }) => {
    const data = room()
    const unavailable = { ...track, vip, streamUrl: vip ? track.streamUrl : undefined }
    data.queue = [unavailable]
    roomRepo.set(data.id, data)
    vi.spyOn(authService, 'getAnyCookie').mockImplementation((source) => source === 'netease' ? currentCookie : targetCookie)
    const search = vi.spyOn(musicProvider, 'search').mockResolvedValue([])
    const stream = vi.spyOn(musicProvider, 'getStreamUrl').mockResolvedValue(null)
    const { io, emit } = ioMock()

    const wasEnabled = config.autoFallback.enabled
    config.autoFallback.enabled = true
    try {
      expect(await playTrackInRoom(io as never, data.id, unavailable)).toBe(false)
    } finally {
      config.autoFallback.enabled = wasEnabled
    }

    expect(data.queue).toEqual([])
    expect(search).not.toHaveBeenCalled()
    expect(stream).toHaveBeenCalledTimes(vip ? 0 : 3)
    expect(emit).not.toHaveBeenCalledWith(EVENTS.ROOM_AUTO_FALLBACK, expect.anything())
    expect(emit).toHaveBeenCalledWith(EVENTS.ROOM_ERROR, expect.objectContaining({ message: expect.stringContaining('VIP') }))
  })

  it.each(['tencent', 'kugou'] as const)('resolves %s queue URLs through the provider again', async (source) => {
    const data = room()
    const queued = { ...track, source, streamUrl: 'https://example.com/stale.mp3' }
    const freshUrl = 'https://example.com/fresh.mp3'
    data.queue = [queued]
    roomRepo.set(data.id, data)
    const stream = vi.spyOn(musicProvider, 'getStreamUrl').mockResolvedValue(freshUrl)

    expect(await playTrackInRoom(ioMock().io as never, data.id, queued)).toBe(true)
    expect(stream).toHaveBeenCalledExactlyOnceWith(source, queued.urlId, data.audioQuality, undefined)
    expect(data.pendingPlayback?.track?.streamUrl).toBe(freshUrl)
  })

  it('pauses at the scheduled execution position without seeking clients backwards', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:10Z'))
    const data = room()
    data.playState.serverTimestamp = Date.now() - 5_000
    roomRepo.set('ROOM01', data)
    const { io, emit } = ioMock()

    pauseTrack(io as never, 'ROOM01')

    expect(data.playState.isPlaying).toBe(true)
    expect(data.pendingPlayback?.type).toBe('pause')
    expect(data.pendingPlayback?.playState.currentTime).toBeCloseTo(15.3, 5)
    expect(data.pendingPlayback?.playState.serverTimestamp).toBe(Date.now() + 300)
    const pausePayload = emit.mock.calls.find(([event]) => event === 'player:pause')?.[1]
    expect(pausePayload).toMatchObject({
      playState: {
        currentTime: expect.closeTo(15.3, 5),
        serverTimeToExecute: Date.now() + 300,
      },
    })
  })

  it('resumes and seeks using future synchronized timestamps', () => {
    const data = room()
    data.playState.isPlaying = false
    roomRepo.set('ROOM01', data)
    roomRepo.setSocketMapping('socket', 'ROOM01', 'owner')
    roomRepo.setSocketRTT('socket', 200)
    const { io } = ioMock()

    resumeTrack(io as never, 'ROOM01')
    expect(data.playState.isPlaying).toBe(false)
    expect(data.pendingPlayback?.type).toBe('resume')
    expect(data.pendingPlayback?.playState.serverTimestamp).toBeGreaterThan(Date.now())

    seekTrack(io as never, 'ROOM01', 60)
    expect(data.pendingPlayback?.type).toBe('seek')
    expect(data.pendingPlayback?.playState.currentTime).toBe(60)
    expect(data.pendingPlayback?.playState.serverTimestamp).toBeGreaterThan(Date.now())

    seekTrack(io as never, 'ROOM01', 999)
    expect(data.pendingPlayback?.playState.currentTime).toBe(track.duration)
  })

  it('does nothing when asked to resume what is already playing, instead of rewinding everybody', () => {
    const data = room()
    data.playState.isPlaying = true
    data.playState.currentTime = 42
    roomRepo.set('ROOM01', data)
    const { io, emit } = ioMock()

    resumeTrack(io as never, 'ROOM01')

    expect(data.pendingPlayback).toBeNull()
    expect(data.playState.currentTime).toBe(42)
    expect(emit.mock.calls.some(([event]) => event === 'player:resume')).toBe(false)
  })

  it('schedules room-wide stop playback at one authoritative time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:10Z'))
    const data = room()
    roomRepo.set('ROOM01', data)
    const { io, emit } = ioMock()

    stopPlayback(io as never, 'ROOM01')

    expect(data.currentTrack).toBe(track)
    expect(data.playState.isPlaying).toBe(true)
    expect(data.pendingPlayback?.type).toBe('stop')
    expect(data.pendingPlayback?.playState.serverTimestamp).toBe(Date.now() + 300)
    const pausePayload = emit.mock.calls.find(([event]) => event === 'player:pause')?.[1]
    expect(pausePayload).toMatchObject({
      playState: { serverTimeToExecute: data.pendingPlayback?.playState.serverTimestamp },
    })
    expect(emit.mock.calls.some(([event]) => event === 'room:state')).toBe(false)

    vi.advanceTimersByTime(300)
    expect(data.currentTrack).toBeNull()
    expect(data.playState).toMatchObject({ isPlaying: false, currentTime: 0 })
    expect(emit.mock.calls.some(([event]) => event === 'room:state')).toBe(true)
  })

  it('does not advance before a future pending play has actually started', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:10Z'))
    const data = room()
    data.currentTrack = null
    data.playState = { isPlaying: false, currentTime: 0, serverTimestamp: Date.now(), revision: 0 }
    const pendingState = {
      isPlaying: true,
      currentTime: 0,
      serverTimestamp: Date.now() + 300,
      serverTimeToExecute: Date.now() + 300,
      revision: 1,
    }
    data.pendingPlayback = {
      type: 'play',
      track,
      playState: pendingState,
      timer: setTimeout(() => {}, 300),
    }
    roomRepo.set('ROOM01', data)
    const { io } = ioMock()

    pauseTrack(io as never, 'ROOM01')

    expect(data.pendingPlayback?.playState.currentTime).toBe(0)
  })

  it('includes pending execution time in public room state for route recovery', () => {
    const data = room()
    roomRepo.set('ROOM01', data)
    const { io } = ioMock()

    pauseTrack(io as never, 'ROOM01')

    expect(toPublicRoomState(data).serverTimeToExecute).toBe(data.pendingPlayback?.playState.serverTimeToExecute)
  })

  it('keeps committed state unchanged until pause execution and then commits it once', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:10Z'))
    const data = room()
    roomRepo.set('ROOM01', data)
    const { io } = ioMock()

    pauseTrack(io as never, 'ROOM01')
    expect(data.playState.isPlaying).toBe(true)
    expect(data.pendingPlayback?.type).toBe('pause')

    vi.advanceTimersByTime(300)
    expect(data.pendingPlayback).toBeNull()
    expect(data.playState.isPlaying).toBe(false)
    expect(data.playState.revision).toBe(1)
  })

  it('treats a pending first track as occupied so a second auto-play cannot replace it', async () => {
    const data = room()
    data.currentTrack = null
    data.playState = { isPlaying: false, currentTime: 0, serverTimestamp: Date.now(), revision: 0 }
    roomRepo.set('ROOM01', data)
    const { io } = ioMock()
    const first = { ...track, id: 'first', sourceId: 'first', urlId: 'first' }
    const second = { ...track, id: 'second', sourceId: 'second', urlId: 'second' }
    data.queue = [first, second]

    expect(await autoPlayIfEmpty(io as never, 'ROOM01', first)).toBe(true)
    expect(await autoPlayIfEmpty(io as never, 'ROOM01', second)).toBe(false)
    expect(data.pendingPlayback?.track?.id).toBe('first')
  })

  it('allows an immediate previous action after next while debouncing duplicate directions', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:10Z'))
    const first = { ...track, id: 'first', sourceId: 'first', urlId: 'first' }
    const second = { ...track, id: 'second', sourceId: 'second', urlId: 'second' }
    const data = room()
    data.queue = [first, second]
    data.currentTrack = first
    roomRepo.set('ROOM01', data)
    const { io, emit } = ioMock()

    await playNextTrackInRoom(io as never, 'ROOM01', 'loop-all')
    expect(data.pendingPlayback?.track?.id).toBe('second')

    vi.advanceTimersByTime(300)
    await playPrevTrackInRoom(io as never, 'ROOM01')
    expect(data.pendingPlayback?.track?.id).toBe('first')

    const playCalls = emit.mock.calls.filter(([event]) => event === 'player:play')
    expect(playCalls).toHaveLength(2)
  })

  describe('in a queue that is consumed as it plays', () => {
    const named = (id: string) => ({ ...track, id, sourceId: id, urlId: id })
    const consumingRoom = (...ids: string[]) => {
      const data = room()
      data.queueMode = 'consume'
      data.queue = ids.map(named)
      data.currentTrack = data.queue[0]
      roomRepo.set('ROOM01', data)
      return data
    }

    it('takes the track just heard out of the queue when moving on, and announces it', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:10Z'))
      const data = consumingRoom('first', 'second', 'third')
      const { io, emit } = ioMock()

      await playNextTrackInRoom(io as never, 'ROOM01', 'loop-all')

      expect(data.pendingPlayback?.track?.id).toBe('second')
      expect(data.queue.map((t) => t.id)).toEqual(['second', 'third'])
      expect(emit).toHaveBeenCalledWith('queue:updated', { queue: data.queue })
    })

    it('ends instead of coming round again after the last track', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:10Z'))
      const data = consumingRoom('only')
      const { io, emit } = ioMock()

      await playNextTrackInRoom(io as never, 'ROOM01', 'loop-all')

      expect(data.queue).toEqual([])
      expect(data.pendingPlayback?.type).toBe('stop')
      expect(emit.mock.calls.some(([event]) => event === 'player:play')).toBe(false)
    })

    it('stops instead of keeping the finished track current when the next ones cannot be resolved', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:10Z'))
      vi.spyOn(musicProvider, 'getStreamUrl').mockResolvedValue(null)
      const data = consumingRoom('a', 'b')
      data.queue = data.queue.map((t) => ({ ...t, streamUrl: undefined }))
      data.currentTrack = data.queue[0]
      const { io } = ioMock()

      await playNextTrackInRoom(io as never, 'ROOM01', 'loop-all')

      expect(data.queue).toEqual([])
      expect(data.pendingPlayback?.type).toBe('stop')
    })

    it('plays what was queued behind it, in the order it was queued', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:10Z'))
      const data = consumingRoom('a', 'b')
      const { io } = ioMock()

      await playNextTrackInRoom(io as never, 'ROOM01', 'loop-one')
      expect(data.pendingPlayback?.track?.id).toBe('b')
      expect(data.queue.map((t) => t.id)).toEqual(['b'])
    })

    it('moves on from a track that is still only scheduled, instead of dropping it unheard', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:10Z'))
      const data = consumingRoom('a', 'b', 'c')
      const { io } = ioMock()

      await playNextTrackInRoom(io as never, 'ROOM01', 'loop-all')
      expect(data.pendingPlayback?.track?.id).toBe('b')

      // b has not started yet (still pending) when the next skip comes in: it is the one being left, so c is next
      await playNextTrackInRoom(io as never, 'ROOM01', 'loop-all', { skipDebounce: true })
      expect(data.pendingPlayback?.track?.id).toBe('c')
      expect(data.queue.map((t) => t.id)).toEqual(['c'])
    })

    it('does not replay a lone track in shuffle mode', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:10Z'))
      const data = consumingRoom('only')
      data.playMode = 'shuffle'
      const { io } = ioMock()

      await playNextTrackInRoom(io as never, 'ROOM01', 'shuffle')

      expect(data.queue).toEqual([])
      expect(data.pendingPlayback?.type).toBe('stop')
    })

    it('keeps every track in a room that keeps its queue', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:10Z'))
      const data = consumingRoom('first', 'second')
      data.queueMode = 'keep'
      const { io } = ioMock()

      await playNextTrackInRoom(io as never, 'ROOM01', 'loop-all')

      expect(data.queue.map((t) => t.id)).toEqual(['first', 'second'])
    })

    it('starts the current track over for "previous", as what was heard has left the queue', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:10Z'))
      const data = consumingRoom('first', 'second')
      data.playState.currentTime = 42
      const { io, emit } = ioMock()

      await playPrevTrackInRoom(io as never, 'ROOM01')

      expect(data.pendingPlayback?.type).toBe('seek')
      expect(data.pendingPlayback?.playState.currentTime).toBe(0)
      expect(data.currentTrack?.id).toBe('first')
      expect(data.queue.map((t) => t.id)).toEqual(['first', 'second'])
      expect(emit.mock.calls.some(([event]) => event === 'player:seek')).toBe(true)
    })

    it('still goes back to a track that was jumped over and not heard yet', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:10Z'))
      const data = consumingRoom('first', 'second')
      data.currentTrack = data.queue[1]
      const { io } = ioMock()

      await playPrevTrackInRoom(io as never, 'ROOM01')

      expect(data.pendingPlayback?.track?.id).toBe('first')
    })

    it('does nothing for "previous" at the start of a room that keeps its queue', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:10Z'))
      const data = consumingRoom('first', 'second')
      data.queueMode = 'keep'
      data.playMode = 'sequential'
      const { io } = ioMock()

      await playPrevTrackInRoom(io as never, 'ROOM01')

      expect(data.pendingPlayback).toBeNull()
    })
  })

  it.each([
    ['previous right after next', 'next', 'a'],
    ['next right after previous', 'prev', 'a'],
  ] as const)('navigates from the scheduled track, not the committed one: %s', async (_name, first, expected) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:10Z'))
    const named = (id: string) => ({ ...track, id, sourceId: id, urlId: id })
    const data = room()
    data.playMode = 'loop-all'
    data.queue = ['a', 'b', 'c'].map(named)
    data.currentTrack = data.queue[0]
    roomRepo.set('ROOM01', data)
    const { io } = ioMock()

    // The first switch is scheduled but not committed yet when the opposite control arrives.
    if (first === 'next') {
      await playNextTrackInRoom(io as never, 'ROOM01', 'loop-all')
      expect(data.pendingPlayback?.track?.id).toBe('b')
      await playPrevTrackInRoom(io as never, 'ROOM01', { skipDebounce: true })
    } else {
      await playPrevTrackInRoom(io as never, 'ROOM01')
      expect(data.pendingPlayback?.track?.id).toBe('c')
      await playNextTrackInRoom(io as never, 'ROOM01', 'loop-all', { skipDebounce: true })
    }

    expect(data.pendingPlayback?.track?.id).toBe(expected)
  })

  it('assigns a unique revision to every replacement action', () => {
    const data = room()
    roomRepo.set('ROOM01', data)
    const { io } = ioMock()

    pauseTrack(io as never, 'ROOM01')
    const pauseRevision = data.pendingPlayback?.playState.revision
    seekTrack(io as never, 'ROOM01', 60)

    expect(data.pendingPlayback?.playState.revision).toBeGreaterThan(pauseRevision ?? -1)
  })

  it('replaces an earlier scheduled action instead of committing both', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:10Z'))
    const data = room()
    roomRepo.set('ROOM01', data)
    const { io } = ioMock()

    pauseTrack(io as never, 'ROOM01')
    seekTrack(io as never, 'ROOM01', 60)
    expect(data.pendingPlayback?.type).toBe('seek')

    vi.advanceTimersByTime(300)
    expect(data.playState.isPlaying).toBe(false)
    expect(data.playState.currentTime).toBe(60)
  })

  it('resets playback state when the current track is cleared', () => {
    roomRepo.set('ROOM01', room())

    setCurrentTrack('ROOM01', null)

    expect(roomRepo.get('ROOM01')).toMatchObject({
      currentTrack: null,
      playState: { isPlaying: false, currentTime: 0 },
    })
  })

  it('allows legitimate long seeks when track duration metadata is missing', () => {
    const data = room()
    data.currentTrack = { ...track, duration: 0 }
    roomRepo.set('ROOM01', data)
    const { io } = ioMock()

    seekTrack(io as never, 'ROOM01', 7_200)

    expect(data.pendingPlayback?.playState.currentTime).toBe(7_200)
  })

  it('ignores non-finite or negative seeks', () => {
    const data = room()
    roomRepo.set('ROOM01', data)
    const { io } = ioMock()

    seekTrack(io as never, 'ROOM01', Number.NaN)
    seekTrack(io as never, 'ROOM01', Number.POSITIVE_INFINITY)
    seekTrack(io as never, 'ROOM01', -1)

    expect(data.pendingPlayback).toBeNull()
  })

  it('clamps a joining client scheduled position to the track duration', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:10Z'))
    const data = room()
    data.currentTrack = { ...track, duration: 120 }
    data.playState = { isPlaying: true, currentTime: 120, serverTimestamp: Date.now(), revision: 3 }
    data.users.push({ id: 'member', nickname: 'Member', role: 'member' })
    roomRepo.set('ROOM01', data)
    const emit = vi.fn()
    const socket = { emit }
    const { io } = ioMock()

    await syncPlaybackToSocket(io as never, socket as never, 'ROOM01', data)

    expect(emit).toHaveBeenCalledWith(
      'player:play',
      expect.objectContaining({
        playState: expect.objectContaining({ currentTime: 120 }),
      }),
    )
  })
})

describe('playerService expired stream URLs', () => {
  const expiredUrl = 'https://m801.music.126.net/20260101080000/token/song.mp3'
  const freshUrl = 'https://m801.music.126.net/20260102080000/token/song.mp3'

  function setup(paused = true) {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:10Z'))
    const data = room()
    data.currentTrack = { ...track, streamUrl: expiredUrl }
    data.queue = [data.currentTrack, { ...track, id: 'track-2' }]
    data.playState = { isPlaying: !paused, currentTime: 42, serverTimestamp: Date.now(), revision: 7 }
    roomRepo.set('ROOM01', data)
    roomRepo.setSocketMapping('socket', 'ROOM01', 'owner')
    const stream = vi.spyOn(musicProvider, 'getStreamUrl').mockResolvedValue(freshUrl)
    const { io, emit } = ioMock()
    const socket = { id: 'socket', emit: vi.fn() }
    return { data, stream, io, emit, socket }
  }

  function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason: Error) => void
    const promise = new Promise<T>((yes, no) => {
      resolve = yes
      reject = no
    })
    return { promise, resolve, reject }
  }

  const settle = () => vi.advanceTimersByTimeAsync(0)

  function acknowledge(io: ReturnType<typeof ioMock>['io'], data: RoomData) {
    const { track, revision } = data.pendingPrepare!
    markClientReady(io as never, data.id, 'socket', track.id, revision)
  }

  it('re-resolves an expired supplied URL without mutating the queued track', async () => {
    const { data, io, emit, stream } = setup()
    const original = data.currentTrack!
    expect(await playTrackInRoom(io as never, 'ROOM01', original)).toBe(true)
    expect(stream).toHaveBeenCalledWith('netease', track.urlId, 320, undefined)
    expect(original.streamUrl).toBe(expiredUrl)
    expect(data.pendingPrepare?.track.streamUrl).toBe(freshUrl)
    acknowledge(io, data)
    expect(emit).toHaveBeenCalledWith(
      'player:play',
      expect.objectContaining({
        track: expect.objectContaining({ id: track.id, streamUrl: freshUrl }),
      }),
    )
    await vi.advanceTimersByTimeAsync(300)
    expect(data.currentTrack?.streamUrl).toBe(freshUrl)
  })

  it('keeps a valid supplied URL and the synchronous resume/seek paths', async () => {
    const { data, io, emit, stream } = setup()
    setCurrentTrack('ROOM01', track)
    data.playState.isPlaying = false // only something paused can be resumed
    expect(resumeTrack(io as never, 'ROOM01')).toBeUndefined()
    expect(seekTrack(io as never, 'ROOM01', 60)).toBeUndefined()
    expect(emit.mock.calls.map(([event]) => event)).toEqual(['player:resume', 'player:seek'])
    expect(await playTrackInRoom(io as never, 'ROOM01', track)).toBe(true)
    acknowledge(io, data)
    expect(data.pendingPlayback?.track?.streamUrl).toBe(track.streamUrl)
    // Playing resolves nothing: the only provider call is the preload of the queue item that comes next.
    expect(stream).toHaveBeenCalledOnce()
  })

  it('reloads a long-paused track at its authoritative position with a new revision', async () => {
    const { data, io, emit, stream } = setup()
    const request = deferred<string | null>()
    stream.mockReturnValueOnce(request.promise)
    data.playState.serverTimestamp -= 3_600_000
    expect(resumeTrack(io as never, 'ROOM01')).toBeUndefined()
    expect(emit).not.toHaveBeenCalled()
    vi.advanceTimersByTime(10_000)
    request.resolve(freshUrl)
    await settle()
    expect(data.pendingPlayback?.playState).toMatchObject({
      isPlaying: true,
      currentTime: 42,
      revision: 8,
      serverTimeToExecute: Date.now() + 300,
    })
    expect(emit).toHaveBeenCalledWith(
      'player:play',
      expect.objectContaining({
        track: expect.objectContaining({ streamUrl: freshUrl }),
      }),
    )
    expect(emit.mock.calls.some(([event]) => event === 'player:resume')).toBe(false)
    await vi.advanceTimersByTimeAsync(300)
    expect(data.currentTrack?.streamUrl).toBe(freshUrl)
    expect(data.playState).toMatchObject({ currentTime: 42, isPlaying: true, revision: 8 })
  })

  it('keeps the paused position while fetching a fresh URL to resume', async () => {
    const { data, io, stream } = setup()
    const request = deferred<string | null>()
    stream.mockReturnValueOnce(request.promise)
    resumeTrack(io as never, 'ROOM01')
    vi.advanceTimersByTime(2_000)
    request.resolve(freshUrl)
    await settle()
    // Resuming a paused room starts from where it stood: nothing runs in between
    expect(data.pendingPlayback?.playState.currentTime).toBeCloseTo(42)
  })

  it('starts the fallback countdown after refreshed playback commits', async () => {
    const { data, io } = setup()
    const short = { ...data.currentTrack!, duration: 43 }
    data.currentTrack = short
    data.queue[0] = short

    resumeTrack(io as never, data.id)
    await vi.advanceTimersByTimeAsync(6_299)
    expect(data.playState.isPlaying).toBe(true)
    expect(data.pendingPrepare).toBeFalsy()

    await vi.advanceTimersByTimeAsync(1)

    expect(data.pendingPrepare?.track.id).toBe('track-2')
  })

  it.each([true, false])('refreshes a seek while preserving paused=%s', async (paused) => {
    const { data, io, emit } = setup(paused)
    expect(seekTrack(io as never, 'ROOM01', 90)).toBeUndefined()
    await settle()
    expect(data.pendingPlayback?.playState).toMatchObject({ currentTime: 90, isPlaying: !paused, revision: 8 })
    expect(emit).toHaveBeenCalledWith(
      'player:play',
      expect.objectContaining({
        track: expect.objectContaining({ streamUrl: freshUrl }),
      }),
    )
    expect(emit.mock.calls.some(([event]) => event === 'player:seek')).toBe(false)
  })

  it('does not resolve a URL for pause or an occupied auto-play', async () => {
    const { data, io, stream } = setup()
    const request = deferred<string | null>()
    stream.mockReturnValueOnce(request.promise)
    resumeTrack(io as never, 'ROOM01')
    expect(await autoPlayIfEmpty(io as never, 'ROOM01', track)).toBe(false)
    expect(stream).toHaveBeenCalledTimes(1)
    request.resolve(freshUrl)
    await settle()
    expect(data.pendingPlayback?.track?.streamUrl).toBe(freshUrl)
    pauseTrack(io as never, 'ROOM01')
    expect(stream).toHaveBeenCalledTimes(1)
  })

  it.each(['empty', 'expired', 'reject'] as const)(
    'reports %s refresh failure without emitting the old URL',
    async (failure) => {
      const { data, io, emit, stream } = setup()
      if (failure === 'reject') stream.mockRejectedValue(new Error('failed'))
      else stream.mockResolvedValue(failure === 'expired' ? expiredUrl : null)
      resumeTrack(io as never, 'ROOM01')
      await settle()
      expect(emit).toHaveBeenCalledWith('room:error', expect.objectContaining({ code: expect.any(String) }))
      expect(emit.mock.calls.some(([event]) => event === 'player:play' || event === 'player:resume')).toBe(false)
      expect(data.pendingPlayback).toBeNull()
      expect(data.currentTrack?.streamUrl).toBe(expiredUrl)
    },
  )

  it.each([
    'pause',
    'seek',
    'stop',
    'safe-stop',
    'play',
    'next',
    'prev',
    'set',
    'revision',
    'delete',
    'recreate',
  ] as const)('discards a pending room refresh after %s', async (control) => {
    const { data, io, emit, stream } = setup()
    const request = deferred<string | null>()
    stream.mockReturnValueOnce(request.promise)
    resumeTrack(io as never, 'ROOM01')
    switch (control) {
      case 'pause':
        pauseTrack(io as never, 'ROOM01')
        break
      case 'seek':
        seekTrack(io as never, 'ROOM01', 100)
        break
      case 'stop':
        stopPlayback(io as never, 'ROOM01')
        break
      case 'safe-stop':
        await stopPlaybackSafe(io as never, 'ROOM01')
        break
      case 'play':
        await playTrackInRoom(io as never, 'ROOM01', data.queue[1])
        break
      case 'next':
        await playNextTrackInRoom(io as never, 'ROOM01', 'loop-all')
        break
      case 'prev':
        await playPrevTrackInRoom(io as never, 'ROOM01')
        break
      case 'set':
        setCurrentTrack('ROOM01', data.queue[1])
        break
      case 'revision':
        data.playState.revision++
        break
      case 'delete':
        cleanupRoom('ROOM01')
        roomRepo.delete('ROOM01')
        break
      case 'recreate':
        cleanupRoom('ROOM01')
        roomRepo.set('ROOM01', room())
        break
    }
    await settle()
    const pending = data.pendingPlayback
    emit.mockClear()
    request.resolve(freshUrl)
    await settle()
    expect(emit).not.toHaveBeenCalled()
    expect(data.pendingPlayback).toBe(pending)
  })

  it('does not report a stale rejected request as a stream failure', async () => {
    const { io, emit, stream } = setup()
    const request = deferred<string | null>()
    stream.mockReturnValueOnce(request.promise)
    resumeTrack(io as never, 'ROOM01')
    pauseTrack(io as never, 'ROOM01')
    emit.mockClear()
    request.reject(new Error('failed'))
    await settle()
    expect(emit).not.toHaveBeenCalled()
  })

  it('prevents an in-flight initial play from overwriting a newer play', async () => {
    const { data, io, emit, stream } = setup()
    const request = deferred<string | null>()
    stream.mockReturnValueOnce(request.promise)
    const first = playTrackInRoom(io as never, 'ROOM01', data.queue[0])
    await settle()
    const second = playTrackInRoom(io as never, 'ROOM01', data.queue[1])
    request.resolve(freshUrl)
    expect(await first).toBe(false)
    expect(await second).toBe(true)
    expect(data.pendingPrepare?.track.id).toBe('track-2')
    acknowledge(io, data)
    expect(emit.mock.calls.filter(([event]) => event === 'player:play')).toHaveLength(1)
    expect(data.pendingPlayback?.track?.id).toBe('track-2')
  })

  it('discards late artwork without invalidating an accepted next through a duplicate next', async () => {
    const { data, io, emit, stream } = setup(false)
    const firstTrack = { ...track, picId: 'artwork-fixture' }
    const nextTrack = { ...track, id: 'track-2', cover: 'https://example.com/next.jpg' }
    data.currentTrack = firstTrack
    data.queue = [firstTrack, nextTrack]
    const artwork = deferred<string>()
    const getCover = vi.spyOn(musicProvider, 'getCover').mockReturnValueOnce(artwork.promise)
    const first = playTrackInRoom(io as never, 'ROOM01', firstTrack)
    await settle()
    expect(getCover).toHaveBeenCalledOnce()
    const next = playNextTrackInRoom(io as never, 'ROOM01', 'loop-all')
    const duplicate = playNextTrackInRoom(io as never, 'ROOM01', 'loop-all')
    artwork.resolve('https://example.com/old.jpg')
    expect(await first).toBe(false)
    await Promise.all([next, duplicate])
    expect(data.pendingPrepare?.track.id).toBe('track-2')
    acknowledge(io, data)
    // Only the preload of the track that follows the accepted next; nothing was resolved for playing it.
    expect(stream).toHaveBeenCalledOnce()
    expect(emit.mock.calls.filter(([event]) => event === 'player:play')).toHaveLength(1)
    expect(data.pendingPlayback?.track).toMatchObject({ id: 'track-2', cover: nextTrack.cover })
  })

  it('sends a fresh current-track copy only to a joining listener', async () => {
    const { data, io, emit, socket } = setup(false)
    data.users.push({ id: 'member', nickname: 'Member', role: 'member' })
    await syncPlaybackToSocket(io as never, socket as never, 'ROOM01', data)
    expect(socket.emit).toHaveBeenCalledWith(
      'player:play',
      expect.objectContaining({
        track: expect.objectContaining({ streamUrl: freshUrl }),
        playState: expect.objectContaining({ isPlaying: true, revision: 7 }),
      }),
    )
    expect(emit).not.toHaveBeenCalled()
    expect(data.currentTrack?.streamUrl).toBe(expiredUrl)
  })

  it.each(['pause', 'seek', 'resume', 'play'] as const)(
    'refreshes a pending %s snapshot without changing its commit track',
    async (type) => {
      const { data, io, socket } = setup(false)
      pauseTrack(io as never, 'ROOM01')
      data.pendingPlayback!.type = type
      const originalPending = data.pendingPlayback!
      await syncPlaybackToSocket(io as never, socket as never, 'ROOM01', data)
      expect(socket.emit).toHaveBeenCalledWith('player:play', {
        track: expect.objectContaining({ streamUrl: freshUrl }),
        playState: originalPending.playState,
      })
      if (type !== 'play')
        expect(socket.emit).toHaveBeenCalledWith('player:' + type, { playState: originalPending.playState })
      expect(data.pendingPlayback).toBe(originalPending)
      expect(data.pendingPlayback?.track?.streamUrl).toBe(expiredUrl)
      await vi.advanceTimersByTimeAsync(300)
      expect(data.currentTrack?.streamUrl).toBe(expiredUrl)
      resumeTrack(io as never, 'ROOM01')
      await settle()
      expect(data.pendingPlayback?.track?.streamUrl).toBe(freshUrl)
    },
  )

  it('takes a new snapshot when pending playback commits during a join refresh', async () => {
    const { data, io, socket, stream } = setup(false)
    pauseTrack(io as never, 'ROOM01')
    data.users.push({ id: 'member', nickname: 'Member', role: 'member' })
    const request = deferred<string | null>()
    stream.mockReturnValueOnce(request.promise)
    const joining = syncPlaybackToSocket(io as never, socket as never, 'ROOM01', data)
    await vi.advanceTimersByTimeAsync(300)
    request.resolve(freshUrl)
    await joining
    expect(socket.emit).toHaveBeenCalledWith(
      'player:play',
      expect.objectContaining({
        track: expect.objectContaining({ streamUrl: freshUrl }),
        playState: expect.objectContaining({ isPlaying: false, revision: 8 }),
      }),
    )
    expect(data.currentTrack?.streamUrl).toBe(expiredUrl)
  })

  it('delegates an alone paused join to a single room-wide refresh', async () => {
    const { data, io, emit, socket, stream } = setup()
    await syncPlaybackToSocket(io as never, socket as never, 'ROOM01', data)
    await settle()
    expect(stream).toHaveBeenCalledTimes(1)
    expect(socket.emit).not.toHaveBeenCalled()
    expect(emit).toHaveBeenCalledWith(
      'player:play',
      expect.objectContaining({
        track: expect.objectContaining({ streamUrl: freshUrl }),
      }),
    )
  })

  it('sends pending pause even when a joining listener refresh fails', async () => {
    const { data, io, socket, stream } = setup(false)
    pauseTrack(io as never, 'ROOM01')
    stream.mockResolvedValue(null)
    await syncPlaybackToSocket(io as never, socket as never, 'ROOM01', data)
    expect(socket.emit.mock.calls.map(([event]) => event)).toEqual(['room:error', 'player:pause'])
  })

  it.each(['leave', 'pause', 'play', 'set', 'revision', 'delete', 'recreate'] as const)(
    'does not send a join snapshot after %s during refresh',
    async (change) => {
      const { data, io, socket, stream } = setup(false)
      const request = deferred<string | null>()
      stream.mockReturnValueOnce(request.promise)
      const joining = syncPlaybackToSocket(io as never, socket as never, 'ROOM01', data)
      switch (change) {
        case 'leave':
          roomRepo.deleteSocketMapping('socket')
          break
        case 'pause':
          pauseTrack(io as never, 'ROOM01')
          break
        case 'play':
          await playTrackInRoom(io as never, 'ROOM01', data.queue[1])
          break
        case 'set':
          setCurrentTrack('ROOM01', data.queue[1])
          break
        case 'revision':
          data.playState.revision++
          break
        case 'delete':
          cleanupRoom('ROOM01')
          roomRepo.delete('ROOM01')
          break
        case 'recreate':
          cleanupRoom('ROOM01')
          roomRepo.set('ROOM01', room())
          break
      }
      request.resolve(freshUrl)
      await joining
      // No playback snapshot for the outdated join. (A still-present member may be told what to fetch next.)
      expect(socket.emit.mock.calls.filter(([event]) => event !== 'player:preload')).toEqual([])
    },
  )
})

describe('playback readiness', () => {
  async function prepareTrack(next: Track = { ...track, id: 'track-2' }) {
    vi.useFakeTimers()
    const data = room()
    data.queue = [track, next]
    data.playMode = 'sequential'
    roomRepo.set(data.id, data)
    roomRepo.setSocketMapping('socket-owner', data.id, 'owner')
    roomRepo.setSocketMapping('socket-guest', data.id, 'guest')
    const { io: mock, emit } = ioMock()
    const io = mock as never
    await playTrackInRoom(io, data.id, next)
    const { revision, deadlineAt } = data.pendingPrepare!
    expect(emit).toHaveBeenCalledWith(EVENTS.PLAYER_PREPARE, { track: next, revision, deadlineAt })
    expect(data.playState).toMatchObject({ isPlaying: false, currentTime: 0, revision })
    expect(emit).not.toHaveBeenCalledWith(EVENTS.PLAYER_PLAY, expect.anything())
    return { io, emit, data, next, revision, deadlineAt }
  }

  it('waits for all tracked sockets and tells late joiners to prepare without waiting for them', async () => {
    const { io, emit, data, next, revision, deadlineAt } = await prepareTrack()
    markClientReady(io, data.id, 'socket-owner', track.id, revision)
    markClientReady(io, data.id, 'socket-owner', next.id, revision - 1)
    expect(data.pendingPrepare?.pendingSockets.size).toBe(2)
    markClientReady(io, data.id, 'socket-owner', next.id, revision)
    markClientReady(io, data.id, 'socket-owner', next.id, revision)
    expect(data.pendingPrepare?.pendingSockets.size).toBe(1)

    const late = { id: 'late-joiner', emit: vi.fn() }
    roomRepo.setSocketMapping(late.id, data.id, 'late-guest')
    await syncPlaybackToSocket(io, late as never, data.id, data)
    expect(late.emit).toHaveBeenCalledExactlyOnceWith(EVENTS.PLAYER_PREPARE, { track: next, revision, deadlineAt })
    markClientReady(io, data.id, late.id, next.id, revision)
    expect(emit).not.toHaveBeenCalledWith(EVENTS.PLAYER_PLAY, expect.anything())

    markClientReady(io, data.id, 'socket-guest', next.id, revision)

    expect(data.pendingPrepare).toBeNull()
    expect(data.pendingPlayback?.playState.revision).toBe(revision + 1)
    expect(data.playState.isPlaying).toBe(false)
    await vi.advanceTimersByTimeAsync(TIMING.READY_GATE_TIMEOUT_MS)
    expect(data.playState.isPlaying).toBe(true)
    expect(emit.mock.calls.filter(([event]) => event === EVENTS.PLAYER_PLAY)).toHaveLength(1)
  })

  it('releases at the 3,500 ms deadline even with no acknowledgements', async () => {
    const { emit, data, next, deadlineAt } = await prepareTrack()
    expect(deadlineAt - Date.now()).toBe(3_500)
    vi.advanceTimersByTime(3_499)
    expect(data.pendingPrepare).toBeTruthy()
    expect(emit).not.toHaveBeenCalledWith(EVENTS.PLAYER_PLAY, expect.anything())

    vi.advanceTimersByTime(1)

    expect(data.pendingPrepare).toBeNull()
    expect(data.pendingPlayback?.track).toEqual(next)
    expect(emit).toHaveBeenCalledWith(EVENTS.PLAYER_PLAY, expect.objectContaining({ track: next }))
  })

  it.each([
    { duration: track.duration, requestedTime: track.duration + 10, startAt: track.duration },
    { duration: 0, requestedTime: 42, startAt: 42 },
  ])('keeps the gate active when seeking a track with duration $duration', async ({ duration, requestedTime, startAt }) => {
    const { io, emit, data, next, revision } = await prepareTrack({ ...track, id: 'track-2', duration })
    const prepare = data.pendingPrepare

    seekTrack(io, data.id, requestedTime)

    expect(data.pendingPrepare).toBe(prepare)
    expect(data.playState).toMatchObject({ isPlaying: false, currentTime: startAt, revision })
    expect(emit).not.toHaveBeenCalledWith(EVENTS.PLAYER_SEEK, expect.anything())
    markClientReady(io, data.id, 'socket-owner', next.id, revision)
    markClientReady(io, data.id, 'socket-guest', next.id, revision)
    expect(data.pendingPrepare).toBeNull()
    expect(emit).toHaveBeenCalledWith(EVENTS.PLAYER_PLAY, {
      track: next,
      playState: expect.objectContaining({ isPlaying: true, currentTime: startAt }),
    })
    await vi.advanceTimersByTimeAsync(300)
    expect(data.playState).toMatchObject({ isPlaying: true, currentTime: startAt })
  })

  it('restarts a preparing consume-mode track without clearing the gate', async () => {
    const { io, data, next, revision } = await prepareTrack()
    data.queueMode = 'consume'
    data.queue = [next]
    const prepare = data.pendingPrepare
    seekTrack(io, data.id, 42)

    await playPrevTrackInRoom(io, data.id)

    expect(data.pendingPrepare).toBe(prepare)
    expect(data.playState.currentTime).toBe(0)
    markClientReady(io, data.id, 'socket-owner', next.id, revision)
    markClientReady(io, data.id, 'socket-guest', next.id, revision)
    await vi.advanceTimersByTimeAsync(300)
    expect(data.playState).toMatchObject({ isPlaying: true, currentTime: 0 })
  })

  it('starts at the seek position when the preparing stream URL needs a refresh', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const { io, emit, data, next, revision } = await prepareTrack({
      ...track,
      id: 'expiring',
      streamUrl: 'https://m701.music.126.net/20260101080031/song.mp3',
    })
    vi.spyOn(musicProvider, 'getStreamUrl').mockResolvedValue(track.streamUrl!)
    await vi.advanceTimersByTimeAsync(1_000)
    seekTrack(io, data.id, 42)
    expect(data.pendingPrepare?.revision).toBe(revision)
    markClientReady(io, data.id, 'socket-owner', next.id, revision)
    markClientReady(io, data.id, 'socket-guest', next.id, revision)
    await vi.advanceTimersByTimeAsync(300)

    expect(data.playState).toMatchObject({ isPlaying: true, currentTime: 42 })
    expect(emit).toHaveBeenCalledWith(EVENTS.PLAYER_PLAY, {
      track: { ...next, streamUrl: track.streamUrl },
      playState: expect.objectContaining({ isPlaying: true, currentTime: 42 }),
    })
  })

  it.each(['play', 'next', 'previous'] as const)('restores the prepared track after a failed %s', async (action) => {
    const { io, emit, data, next: prepared } = await prepareTrack()
    const unavailable = { ...track, streamUrl: undefined }
    data.queue = action === 'previous' ? [unavailable, prepared] : [prepared, unavailable]
    data.playMode = 'loop-all'
    vi.spyOn(musicProvider, 'getStreamUrl').mockResolvedValue(null)
    vi.spyOn(musicProvider, 'search').mockResolvedValue([])
    seekTrack(io, data.id, 42)

    if (action === 'play') expect(await playTrackInRoom(io, data.id, unavailable)).toBe(false)
    if (action === 'next') await playNextTrackInRoom(io, data.id, data.playMode)
    if (action === 'previous') await playPrevTrackInRoom(io, data.id)

    expect(data.pendingPrepare).toBeNull()
    expect(emit).toHaveBeenCalledWith(EVENTS.PLAYER_PLAY, {
      track: prepared,
      playState: expect.objectContaining({ isPlaying: true, currentTime: 42 }),
    })
    await vi.advanceTimersByTimeAsync(300)
    expect(data.currentTrack).toEqual(prepared)
    expect(data.playState).toMatchObject({ isPlaying: true, currentTime: 42 })
  })

  it('refreshes an expired prepared URL and resumes at the saved position after a failed switch', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const { io, emit, data, next: prepared } = await prepareTrack({
      ...track,
      id: 'expiring',
      urlId: 'expiring',
      streamUrl: 'https://m701.music.126.net/20260101080031/song.mp3',
    })
    const unavailable = { ...track, streamUrl: undefined }
    const freshUrl = 'https://m701.music.126.net/20260101080131/song.mp3'
    data.queue = [prepared, unavailable]
    const stream = vi.spyOn(musicProvider, 'getStreamUrl').mockImplementation(async (_source, id) =>
      id === prepared.urlId ? freshUrl : null,
    )
    vi.spyOn(musicProvider, 'search').mockResolvedValue([])
    seekTrack(io, data.id, 42)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(data.playState.isPlaying).toBe(false)

    expect(await playTrackInRoom(io, data.id, unavailable)).toBe(false)
    await vi.advanceTimersByTimeAsync(300)

    const refreshed = { ...prepared, streamUrl: freshUrl }
    expect(stream).toHaveBeenCalledWith(prepared.source, prepared.urlId, 320, undefined)
    expect(data.pendingPrepare).toBeNull()
    expect(emit).toHaveBeenCalledWith(EVENTS.PLAYER_PLAY, {
      track: refreshed,
      playState: expect.objectContaining({ isPlaying: true, currentTime: 42 }),
    })
    expect(data.currentTrack).toEqual(refreshed)
    expect(data.playState).toMatchObject({ isPlaying: true, currentTime: 42 })
  })

  it('restores the prepared track when a newer failed switch supersedes one still resolving', async () => {
    const { io, data, next: prepared } = await prepareTrack()
    const superseded = { ...track, streamUrl: undefined }
    const unavailable = { ...superseded, id: 'unavailable', urlId: 'unavailable' }
    data.queue = [prepared, superseded, unavailable]
    const request = Promise.withResolvers<string | null>()
    const stream = vi.spyOn(musicProvider, 'getStreamUrl').mockResolvedValue(null).mockReturnValueOnce(request.promise)
    vi.spyOn(musicProvider, 'search').mockResolvedValue([])
    seekTrack(io, data.id, 42)

    const first = playTrackInRoom(io, data.id, superseded)
    await vi.advanceTimersByTimeAsync(0)
    expect(stream).toHaveBeenCalledWith(superseded.source, superseded.urlId, 320, undefined)
    const second = playTrackInRoom(io, data.id, unavailable)
    request.resolve(track.streamUrl!)
    expect(await first).toBe(false)
    expect(await second).toBe(false)
    await vi.advanceTimersByTimeAsync(300)

    expect(data.currentTrack).toEqual(prepared)
    expect(data.playState).toMatchObject({ isPlaying: true, currentTime: 42 })
  })

  it('starts playback when at least one tracked client is ready', async () => {
    const { io, emit, data, next, revision } = await prepareTrack()
    markClientReady(io, data.id, 'socket-owner', next.id, revision, true)
    markClientReady(io, data.id, 'socket-guest', next.id, revision)

    expect(data.pendingPrepare).toBeNull()
    expect(emit).toHaveBeenCalledWith(EVENTS.PLAYER_PLAY, expect.objectContaining({ track: next }))
  })

  it('stops when every client fails and the mode would repeat the only track', async () => {
    const { io, emit, data, next, revision } = await prepareTrack({ ...track, id: 'track-2', urlId: 'track-2' })
    const invalidate = vi.spyOn(musicProvider, 'invalidateStreamUrl')
    data.queue = [next]
    data.playMode = 'loop-one'

    markClientReady(io, data.id, 'socket-owner', next.id, revision, true)
    markClientReady(io, data.id, 'socket-guest', next.id, revision, true)
    await vi.advanceTimersByTimeAsync(300)

    expect(data.pendingPrepare).toBeNull()
    expect(data.currentTrack).toBeNull()
    expect(data.queue[0].streamUrl).toBeUndefined()
    expect(next.streamUrl).toBe(track.streamUrl)
    expect(invalidate).toHaveBeenCalledExactlyOnceWith(next.source, next.urlId)
    expect(emit).toHaveBeenCalledWith(EVENTS.QUEUE_UPDATED, { queue: data.queue })
    expect(emit).not.toHaveBeenCalledWith(EVENTS.PLAYER_PLAY, expect.anything())
  })

  it.each(['pause', 'stop', 'new track', 'cleanup'])('cancels the old gate on %s', async (action) => {
    const { io, emit, data, next, revision } = await prepareTrack()
    if (action === 'pause') pauseTrack(io, data.id)
    if (action === 'stop') stopPlayback(io, data.id)
    if (action === 'cleanup') cleanupRoom(data.id)
    if (action === 'new track') {
      vi.spyOn(musicProvider, 'getStreamUrl').mockResolvedValue(next.streamUrl!)
      await vi.advanceTimersByTimeAsync(500)
      await playTrackInRoom(io, data.id, track)
      expect(data.pendingPrepare?.revision).toBeGreaterThan(revision)
    }
    markClientReady(io, data.id, 'socket-owner', next.id, revision)
    markClientReady(io, data.id, 'socket-guest', next.id, revision)
    await vi.advanceTimersByTimeAsync(TIMING.READY_GATE_TIMEOUT_MS)

    expect(emit).not.toHaveBeenCalledWith(EVENTS.PLAYER_PLAY, expect.objectContaining({ track: next }))
    expect(data.pendingPrepare).toBeNull()
  })
})

describe('end-of-track fallback', () => {
  async function playShortTrack() {
    vi.useFakeTimers()
    const data = room()
    const short = { ...track, duration: 2 }
    const next = { ...track, id: 'track-2' }
    data.playMode = 'sequential'
    data.queue = [short, next]
    roomRepo.set(data.id, data)
    vi.spyOn(musicProvider, 'getStreamUrl').mockResolvedValue(next.streamUrl!)
    const { io: mock, emit } = ioMock()
    const io = mock as never
    await playTrackInRoom(io, data.id, short)
    await vi.advanceTimersByTimeAsync(300)
    expect(data.currentTrack).toEqual(short)
    return { data, short, next, io, emit }
  }

  it('advances at duration plus five seconds even after the host disconnects', async () => {
    const { data, next, emit } = await playShortTrack()
    roomRepo.setSocketMapping('socket-owner', data.id, 'owner')
    joinRoom('socket-guest', data.id, 'Guest', 'guest')
    leaveRoom('socket-owner')
    expect(data.hostId).toBe('guest')
    await vi.advanceTimersByTimeAsync(6_999)
    expect(emit.mock.calls.filter(([event]) => event === EVENTS.PLAYER_PREPARE)).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(1)

    expect(data.pendingPrepare?.track).toEqual(next)
  })

  it.each(['unchanged', 'seek'] as const)('rechecks %s playback after the fallback waits for the mutex', async (action) => {
    const { data, short, next, io } = await playShortTrack()
    vi.advanceTimersByTime(6_999)
    const autoPlay = autoPlayIfEmpty(io, data.id, next)
    // The timer fires before the queued auto-play has checked whether the room is empty.
    vi.advanceTimersByTime(1)
    expect(data.pendingPlayback).toBeNull()
    if (action === 'seek') seekTrack(io, data.id, 0)
    expect(await autoPlay).toBe(false)
    await vi.advanceTimersByTimeAsync(0)

    expect(data.pendingPlayback?.track).toEqual(action === 'seek' ? short : next)
    expect(data.pendingPlayback?.type).toBe(action === 'seek' ? 'seek' : 'play')
  })

  it.each(['pause', 'stop', 'cleanup'])('cancels the fallback on %s', async (action) => {
    const { data, io, emit } = await playShortTrack()
    if (action === 'pause') pauseTrack(io, data.id)
    if (action === 'stop') stopPlayback(io, data.id)
    if (action === 'cleanup') cleanupRoom(data.id)

    await vi.advanceTimersByTimeAsync(10_000)

    expect(emit.mock.calls.filter(([event]) => event === EVENTS.PLAYER_PLAY)).toHaveLength(1)
  })

  it('restarts the countdown from the committed seek position', async () => {
    const { data, io, emit, next } = await playShortTrack()
    seekTrack(io, data.id, 2)
    await vi.advanceTimersByTimeAsync(5_299)
    expect(emit.mock.calls.filter(([event]) => event === EVENTS.PLAYER_PLAY)).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(1)

    expect(data.pendingPlayback?.track).toEqual(next)
  })

  it('counts the remaining time again after resuming', async () => {
    const { data, io, emit, next } = await playShortTrack()
    pauseTrack(io, data.id)
    await vi.advanceTimersByTimeAsync(300)
    const pausedAt = data.playState.currentTime

    await vi.advanceTimersByTimeAsync(10_000)
    resumeTrack(io, data.id)
    const remainingMs = (2 - pausedAt) * 1000
    await vi.advanceTimersByTimeAsync(300 + remainingMs + 4_999)
    expect(emit.mock.calls.filter(([event]) => event === EVENTS.PLAYER_PLAY)).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(1)

    expect(data.pendingPlayback?.track).toEqual(next)
  })
})

describe('preloading the next track', () => {
  const second: Track = { ...track, id: 'track-2', sourceId: 'track-2', urlId: 'track-2', streamUrl: undefined }
  const third: Track = { ...track, id: 'track-3', sourceId: 'track-3', urlId: 'track-3', streamUrl: undefined }
  const nextUrl = 'https://cdn.example.com/next.mp3'

  function playing(mode: RoomData['playMode'] = 'sequential') {
    const data = room()
    data.playMode = mode
    // Fresh items per test: preloading stores the resolved URL on the queue item itself.
    data.queue = [track, { ...second }, { ...third }]
    roomRepo.set('ROOM01', data)
    return data
  }
  const preloads = (emit: ReturnType<typeof vi.fn>) => emit.mock.calls.filter(([event]) => event === 'player:preload')

  it('resolves the following track, keeps the URL on its queue item and announces it to the room', async () => {
    const data = playing()
    const stream = vi.spyOn(musicProvider, 'getStreamUrl').mockResolvedValue(nextUrl)
    const { io, emit } = ioMock()

    await preloadUpcoming(io as never, 'ROOM01')

    expect(stream).toHaveBeenCalledExactlyOnceWith('netease', 'track-2', 320, undefined)
    expect(preloads(emit)).toEqual([
      ['player:preload', { track: expect.objectContaining({ id: 'track-2', streamUrl: nextUrl }) }],
    ])
    expect(data.queue[1].streamUrl).toBe(nextUrl)
    expect(data.queue[2].streamUrl).toBeUndefined()
  })

  it('discards a URL that finished resolving after the audio quality changed', async () => {
    const data = playing()
    let finish: (url: string) => void = () => {}
    vi.spyOn(musicProvider, 'getStreamUrl').mockReturnValue(new Promise((resolve) => (finish = resolve)))
    const { io, emit } = ioMock()

    const pending = preloadUpcoming(io as never, 'ROOM01')
    data.audioQuality = 128
    finish(nextUrl)
    await pending

    expect(preloads(emit)).toHaveLength(0)
    expect(data.queue[1].streamUrl).toBeUndefined()
  })

  it('does not repeat an announcement for the same upcoming track', async () => {
    playing()
    const stream = vi.spyOn(musicProvider, 'getStreamUrl').mockResolvedValue(nextUrl)
    const { io, emit } = ioMock()
    await preloadUpcoming(io as never, 'ROOM01')
    await preloadUpcoming(io as never, 'ROOM01')
    expect(stream).toHaveBeenCalledOnce()
    expect(preloads(emit)).toHaveLength(1)
  })

  it('announces again when the next track changes, for example after a reorder', async () => {
    const data = playing()
    vi.spyOn(musicProvider, 'getStreamUrl').mockResolvedValue(nextUrl)
    const { io, emit } = ioMock()
    await preloadUpcoming(io as never, 'ROOM01')
    data.queue = [track, third, second]
    await preloadUpcoming(io as never, 'ROOM01')
    expect(preloads(emit).map(([, payload]) => payload.track.id)).toEqual(['track-2', 'track-3'])
  })

  it('looks past a transition that is scheduled but not committed yet', async () => {
    const data = playing()
    data.pendingPlayback = {
      type: 'play',
      track: second,
      playState: {
        isPlaying: true,
        currentTime: 0,
        serverTimestamp: Date.now() + 500,
        revision: 1,
        serverTimeToExecute: Date.now() + 500,
      },
      timer: undefined as never,
    }
    vi.spyOn(musicProvider, 'getStreamUrl').mockResolvedValue(nextUrl)
    const { io, emit } = ioMock()
    await preloadUpcoming(io as never, 'ROOM01')
    expect(preloads(emit)[0][1].track.id).toBe('track-3')
  })

  it('lets loop-one reuse the current buffer', async () => {
    playing('loop-one')
    const stream = vi.spyOn(musicProvider, 'getStreamUrl').mockResolvedValue(nextUrl)
    const { io, emit } = ioMock()
    await preloadUpcoming(io as never, 'ROOM01')
    expect(stream).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })

  it.each(['keep', 'consume'] as const)('reuses the preloaded shuffle pick in a %s queue', async (queueMode) => {
    const data = playing('shuffle')
    data.queueMode = queueMode
    vi.spyOn(musicProvider, 'getStreamUrl').mockResolvedValue(nextUrl)
    const random = vi.spyOn(Math, 'random').mockReturnValue(0)
    const { io, emit } = ioMock()

    await preloadUpcoming(io as never, 'ROOM01')
    random.mockReturnValue(0.99)
    await preloadUpcoming(io as never, 'ROOM01')
    expect(preloads(emit)).toEqual([
      [EVENTS.PLAYER_PRELOAD, { track: expect.objectContaining({ id: second.id, streamUrl: nextUrl }) }],
    ])

    await playNextTrackInRoom(io as never, 'ROOM01', 'shuffle')

    expect(data.pendingPlayback?.track).toMatchObject({ id: second.id, streamUrl: nextUrl })
  })

  it('picks a new shuffle successor when the preloaded track is removed', async () => {
    const data = playing('shuffle')
    vi.spyOn(musicProvider, 'getStreamUrl').mockResolvedValue(nextUrl)
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { io, emit } = ioMock()
    await preloadUpcoming(io as never, 'ROOM01')
    data.queue = data.queue.filter((item) => item.id !== second.id)

    await preloadUpcoming(io as never, 'ROOM01')
    expect(preloads(emit).map(([, payload]) => payload.track.id)).toEqual([second.id, third.id])

    await playNextTrackInRoom(io as never, 'ROOM01', 'shuffle')

    expect(data.pendingPlayback?.track?.id).toBe(third.id)
  })

  it('announces nothing at the end of a sequential queue or when the queue would replay the same track', async () => {
    const data = playing()
    data.queue = [second, third, track]
    data.currentTrack = track
    const { io, emit } = ioMock()
    const stream = vi.spyOn(musicProvider, 'getStreamUrl').mockResolvedValue(nextUrl)
    await preloadUpcoming(io as never, 'ROOM01')
    data.queue = [track]
    data.playMode = 'loop-all'
    await preloadUpcoming(io as never, 'ROOM01')
    expect(stream).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })

  it('stays silent when the URL cannot be resolved, or when the room moved on while it was resolving', async () => {
    const data = playing()
    const { io, emit } = ioMock()
    const stream = vi.spyOn(musicProvider, 'getStreamUrl').mockResolvedValue(null)
    await preloadUpcoming(io as never, 'ROOM01')
    stream.mockRejectedValue(new Error('provider down'))
    await preloadUpcoming(io as never, 'ROOM01')
    expect(emit).not.toHaveBeenCalled()
    expect(data.queue[1].streamUrl).toBeUndefined()

    let answer!: (url: string) => void
    stream.mockReturnValue(new Promise<string>((resolve) => (answer = resolve)))
    const pending = preloadUpcoming(io as never, 'ROOM01')
    data.currentTrack = second
    answer(nextUrl)
    await pending
    expect(emit).not.toHaveBeenCalled()
  })

  it('tells a member who joins mid-track which track to fetch next, but only while they are still in the room', async () => {
    const data = playing()
    data.users.push({ id: 'member', nickname: 'Member', role: 'member' })
    vi.spyOn(musicProvider, 'getStreamUrl').mockResolvedValue(nextUrl)
    const { io } = ioMock()
    await preloadUpcoming(io as never, 'ROOM01')

    const socket = { id: 'socket', emit: vi.fn() }
    roomRepo.setSocketMapping('socket', 'ROOM01', 'member')
    await syncPlaybackToSocket(io as never, socket as never, 'ROOM01', data)
    expect(socket.emit).toHaveBeenCalledWith('player:preload', {
      track: expect.objectContaining({ id: 'track-2', streamUrl: nextUrl }),
    })

    const gone = { id: 'gone', emit: vi.fn() }
    await syncPlaybackToSocket(io as never, gone as never, 'ROOM01', data)
    expect(gone.emit).not.toHaveBeenCalledWith('player:preload', expect.anything())
  })

  it('is requested after a track starts playing, and its URL is then used instead of resolving again', async () => {
    const data = playing()
    data.currentTrack = null
    data.playState = { isPlaying: false, currentTime: 0, serverTimestamp: 0, revision: 0 }
    const stream = vi.spyOn(musicProvider, 'getStreamUrl').mockResolvedValue(nextUrl)
    const { io, emit } = ioMock()

    await playTrackInRoom(io as never, 'ROOM01', track)
    await vi.waitFor(() => expect(preloads(emit)).toHaveLength(1))
    expect(preloads(emit)[0][1].track.id).toBe('track-2')

    stream.mockClear()
    await playTrackInRoom(io as never, 'ROOM01', data.queue[1])
    expect(stream).not.toHaveBeenCalledWith('netease', 'track-2', expect.anything(), expect.anything())
    const played = emit.mock.calls.filter(([event]) => event === 'player:play').at(-1)?.[1]
    expect(played.track).toMatchObject({ id: 'track-2', streamUrl: nextUrl })
  })
})
