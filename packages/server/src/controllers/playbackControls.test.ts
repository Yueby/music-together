import { ERROR_CODE, EVENTS, type Track } from '@music-together/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkSocketRateLimit } from '../middleware/socketRateLimiter.js'
import type { TypedServer, TypedSocket } from '../middleware/types.js'
import { chatRepo } from '../repositories/chatRepository.js'
import { roomRepo } from '../repositories/roomRepository.js'
import * as playerService from '../services/playerService.js'
import { musicProvider } from '../services/musicProvider.js'
import { clearAllTimers } from '../services/roomLifecycleService.js'
import { createRoom, joinRoom } from '../services/roomService.js'
import { cancelVote, getActiveVote } from '../services/voteService.js'
import { registerPlayerController } from './playerController.js'
import { registerQueueController } from './queueController.js'
import { registerRoomController } from './roomController.js'
import { registerVoteController } from './voteController.js'

const track: Track = {
  id: 'first-track', source: 'netease', sourceId: '1', urlId: '1',
  title: 'Song', artist: [], album: '', cover: '', duration: 120,
  streamUrl: 'https://example.test/song.mp3',
}
const nextTrack = { ...track, id: 'next-track' }
const broadcast = vi.fn()
const io = { to: () => ({ emit: broadcast }) } as unknown as TypedServer
const socketIds: string[] = []
let sequence = 0

function connect() {
  const id = `playback-test-${++sequence}`
  socketIds.push(id)
  const handlers = new Map<string, (data?: unknown) => unknown>()
  const emit = vi.fn()
  const socket = {
    id,
    data: { identityUserId: id },
    emit,
    join: vi.fn(),
    leave: vi.fn(),
    on: (event: string, handler: (data?: unknown) => unknown) => handlers.set(event, handler),
  } as unknown as TypedSocket
  registerPlayerController(io, socket)
  registerQueueController(io, socket)
  registerRoomController(io, socket)
  registerVoteController(io, socket)
  return { socket, emit, send: (event: string, data?: unknown) => handlers.get(event)!.call(socket, data) }
}

function setup() {
  vi.spyOn(musicProvider, 'getStreamUrl').mockResolvedValue(track.streamUrl!)
  const owner = connect()
  const { room, user } = createRoom(owner.socket.id, 'Owner')
  room.queue = [track, nextTrack]
  room.currentTrack = track
  room.playState = { isPlaying: true, currentTime: 0, serverTimestamp: Date.now(), revision: 2 }
  return { owner, room, user }
}

async function exhaustBudget(socket: TypedSocket) {
  for (let i = 0; i < 10; i++) expect(await checkSocketRateLimit(socket)).toBe(true)
}

afterEach(() => {
  for (const id of roomRepo.getAllIds()) {
    cancelVote(id)
    playerService.cleanupRoom(id)
    roomRepo.delete(id)
    chatRepo.deleteRoom(id)
  }
  for (const id of socketIds.splice(0)) roomRepo.deleteSocketMapping(id)
  clearAllTimers()
  vi.restoreAllMocks()
  vi.useRealTimers()
  broadcast.mockClear()
})

describe('PLAYER_NEXT', () => {
  it('requires play permission for a manual next, including from an unprivileged conductor', async () => {
    const { owner, user, room } = setup()
    user.role = 'member'
    await owner.send(EVENTS.PLAYER_NEXT)

    expect(owner.emit).toHaveBeenCalledWith(EVENTS.ROOM_ERROR, expect.objectContaining({ code: ERROR_CODE.NO_PERMISSION }))
    expect(room.pendingPlayback).toBeFalsy()
  })

  it('validates auto-next and silently ignores an outdated track or revision', async () => {
    const { owner, room } = setup()
    await owner.send(EVENTS.PLAYER_NEXT, { auto: true, trackId: track.id, revision: -1 })
    expect(owner.emit).toHaveBeenCalledWith(EVENTS.ROOM_ERROR, expect.objectContaining({ code: ERROR_CODE.INVALID_DATA }))
    owner.emit.mockClear()
    room.pendingPlayback = {
      type: 'play',
      track: nextTrack,
      playState: { ...room.playState, revision: 3, serverTimeToExecute: Date.now() + 1_000 },
      timer: setTimeout(() => {}, 1_000),
    }
    await owner.send(EVENTS.PLAYER_NEXT, { auto: true, trackId: nextTrack.id, revision: 2 })
    await owner.send(EVENTS.PLAYER_NEXT, { auto: true, trackId: track.id, revision: 3 })

    expect(owner.emit).not.toHaveBeenCalled()
    expect(room.pendingPlayback?.track).toEqual(nextTrack)
    expect(room.pendingPlayback?.playState.revision).toBe(3)
  })

  it('limits a manual skip and accepts a near-end auto-advance with the budget exhausted', async () => {
    const { owner, room, user } = setup()
    room.playState.currentTime = track.duration - 5
    await exhaustBudget(owner.socket)
    await owner.send(EVENTS.PLAYER_NEXT)
    expect(owner.emit).toHaveBeenCalledWith(EVENTS.ROOM_ERROR, expect.objectContaining({ code: ERROR_CODE.RATE_LIMITED }))
    expect(room.pendingPlayback).toBeFalsy()

    user.role = 'member'
    owner.emit.mockClear()
    await owner.send(EVENTS.PLAYER_NEXT, { auto: true, trackId: track.id, revision: 2 })
    expect(owner.emit).not.toHaveBeenCalled()
    expect(room.pendingPrepare?.track).toEqual(nextTrack)
  })

  it('rejects a premature auto-next and accepts a near-end report from a non-conductor', async () => {
    const { room } = setup()
    const guest = connect()
    joinRoom(guest.socket.id, room.id, 'Guest')
    await guest.send(EVENTS.PLAYER_NEXT, { auto: true, trackId: track.id, revision: 2 })
    expect(room.pendingPrepare).toBeFalsy()
    room.playState.currentTime = track.duration - 4
    await guest.send(EVENTS.PLAYER_NEXT, { auto: true, trackId: track.id, revision: 2 })

    expect(guest.emit).not.toHaveBeenCalled()
    expect(room.pendingPrepare?.track).toEqual(nextTrack)
  })

  it('accepts an auto-next for unknown duration only from the host’s conductor socket', async () => {
    const { owner, room, user } = setup()
    room.currentTrack = { ...track, duration: 0 }
    room.queue = [room.currentTrack, nextTrack]
    const guest = connect()
    joinRoom(guest.socket.id, room.id, 'Guest')
    const otherHostSocket = connect()
    roomRepo.setSocketMapping(otherHostSocket.socket.id, room.id, user.id)
    const report = { auto: true, trackId: track.id, revision: 2 }

    await guest.send(EVENTS.PLAYER_NEXT, report)
    await otherHostSocket.send(EVENTS.PLAYER_NEXT, report)
    expect(room.pendingPrepare).toBeFalsy()

    await owner.send(EVENTS.PLAYER_NEXT, report)
    expect(room.pendingPrepare?.track).toEqual(nextTrack)
  })

  it('ignores a matching report when playback is paused', async () => {
    const { owner, room } = setup()
    room.playState.isPlaying = false
    room.playState.currentTime = track.duration

    await owner.send(EVENTS.PLAYER_NEXT, { auto: true, trackId: track.id, revision: 2 })

    expect(room.pendingPrepare).toBeFalsy()
  })
})

describe('playback sync and readiness', () => {
  it('skips a track after every tracked socket reports a load failure', async () => {
    vi.useFakeTimers()
    const { owner, room } = setup()
    const guest = connect()
    joinRoom(guest.socket.id, room.id, 'Guest')
    room.playMode = 'sequential'
    await playerService.playTrackInRoom(io, room.id, track)
    const report = { trackId: track.id, revision: room.pendingPrepare!.revision, failed: true }

    await owner.send(EVENTS.PLAYER_READY, report)
    expect(room.pendingPrepare?.pendingSockets).toEqual(new Set([guest.socket.id]))
    await guest.send(EVENTS.PLAYER_READY, report)
    await vi.advanceTimersByTimeAsync(0)

    expect(room.pendingPrepare?.track).toEqual(nextTrack)
    expect(broadcast).not.toHaveBeenCalledWith(EVENTS.PLAYER_PLAY, expect.objectContaining({ track }))
    const ready = { trackId: nextTrack.id, revision: room.pendingPrepare!.revision }
    await owner.send(EVENTS.PLAYER_READY, ready)
    await guest.send(EVENTS.PLAYER_READY, ready)
    expect(broadcast.mock.calls.filter(([event]) => event === EVENTS.PLAYER_PLAY)).toEqual([
      [EVENTS.PLAYER_PLAY, { track: nextTrack, playState: expect.objectContaining({ isPlaying: true }) }],
    ])
  })

  it('keeps the server timeline when the host reports a position two seconds behind', async () => {
    vi.useFakeTimers()
    const { owner, room } = setup()
    const timeline = room.playState
    vi.advanceTimersByTime(10_000)

    await owner.send(EVENTS.PLAYER_SYNC, { trackId: track.id, revision: 2, currentTime: 8, hostServerTime: Date.now() })
    await owner.send(EVENTS.PLAYER_SYNC_REQUEST)

    expect(room.playState).toBe(timeline)
    expect(owner.emit).toHaveBeenCalledWith(EVENTS.PLAYER_SYNC_RESPONSE, expect.objectContaining({ currentTime: 10 }))
  })

  it.each([EVENTS.ROOM_LEAVE, 'disconnect'])('releases the gate after a ready ACK and %s', async (event) => {
    const { owner, room } = setup()
    const guest = connect()
    joinRoom(guest.socket.id, room.id, 'Guest')
    await exhaustBudget(owner.socket)
    await playerService.playTrackInRoom(io, room.id, nextTrack)
    const revision = room.pendingPrepare!.revision

    await owner.send(EVENTS.PLAYER_READY, { trackId: nextTrack.id, revision: -1 })
    expect(room.pendingPrepare?.pendingSockets.size).toBe(2)
    await owner.send(EVENTS.PLAYER_READY, { trackId: nextTrack.id, revision })
    expect(room.pendingPrepare?.pendingSockets).toEqual(new Set([guest.socket.id]))
    expect(broadcast).not.toHaveBeenCalledWith(EVENTS.PLAYER_PLAY, expect.anything())

    await guest.send(event, 'transport close')

    expect(room.pendingPrepare).toBeNull()
    expect(room.pendingPlayback?.track).toEqual(nextTrack)
    expect(broadcast).toHaveBeenCalledWith(EVENTS.PLAYER_PLAY, expect.objectContaining({ track: nextTrack }))
  })
})

describe('shared playback, queue, and vote rate limit', () => {
  it('checks every control against the same identity budget', async () => {
    const { owner, room } = setup()
    for (let i = 0; i < 10; i++) await owner.send(EVENTS.PLAYER_SEEK, { currentTime: i })
    for (const event of [
      EVENTS.PLAYER_PLAY, EVENTS.PLAYER_PAUSE, EVENTS.PLAYER_SEEK, EVENTS.PLAYER_PREV, EVENTS.PLAYER_SET_MODE,
      EVENTS.QUEUE_ADD, EVENTS.QUEUE_ADD_BATCH, EVENTS.QUEUE_INSERT_AFTER_CURRENT,
      EVENTS.QUEUE_REMOVE, EVENTS.QUEUE_REORDER, EVENTS.QUEUE_CLEAR,
      EVENTS.VOTE_START, EVENTS.VOTE_CAST,
    ]) {
      owner.emit.mockClear()
      await owner.send(event)
      expect(owner.emit, event).toHaveBeenCalledExactlyOnceWith(
        EVENTS.ROOM_ERROR,
        expect.objectContaining({ code: ERROR_CODE.RATE_LIMITED }),
      )
    }
    expect(room.queue).toEqual([track, nextTrack])
  })
})

describe('VOTE_CAST', () => {
  it('reports when there is no active vote', async () => {
    const { owner } = setup()
    await owner.send(EVENTS.VOTE_CAST, { approve: true })
    expect(owner.emit).toHaveBeenCalledExactlyOnceWith(EVENTS.ROOM_ERROR, {
      code: ERROR_CODE.INVALID_INPUT, message: '当前没有进行中的投票',
    })
  })

  it.each(['next', 'prev'])('keeps the new track when an old %s vote receives majority approval', async (action) => {
    const { owner, room } = setup()
    const guest = connect()
    joinRoom(guest.socket.id, room.id, 'Guest')
    await guest.send(EVENTS.VOTE_START, { action })
    expect(getActiveVote(room.id)?.payload).toEqual({ trackId: track.id })

    expect(await playerService.playTrackInRoom(io, room.id, nextTrack)).toBe(true)
    const pending = room.pendingPrepare
    expect(pending?.track).toEqual(nextTrack)
    await owner.send(EVENTS.VOTE_CAST, { approve: true })

    expect(getActiveVote(room.id)).toBeNull()
    expect(room.pendingPrepare).toBe(pending)
    expect(broadcast).toHaveBeenCalledWith(EVENTS.VOTE_RESULT, { passed: false, action, reason: 'action_failed' })
  })
})
