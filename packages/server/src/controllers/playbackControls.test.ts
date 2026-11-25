import { ERROR_CODE, EVENTS, type Track } from '@music-together/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkSocketRateLimit } from '../middleware/socketRateLimiter.js'
import type { TypedServer, TypedSocket } from '../middleware/types.js'
import { chatRepo } from '../repositories/chatRepository.js'
import { roomRepo } from '../repositories/roomRepository.js'
import * as playerService from '../services/playerService.js'
import { clearAllTimers } from '../services/roomLifecycleService.js'
import { createRoom, joinRoom } from '../services/roomService.js'
import { cancelVote, getActiveVote } from '../services/voteService.js'
import { registerPlayerController } from './playerController.js'
import { registerQueueController } from './queueController.js'
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
    on: (event: string, handler: (data?: unknown) => unknown) => handlers.set(event, handler),
  } as unknown as TypedSocket
  registerPlayerController(io, socket)
  registerQueueController(io, socket)
  registerVoteController(io, socket)
  return { socket, emit, send: (event: string, data?: unknown) => handlers.get(event)!.call(socket, data) }
}

function setup() {
  const owner = connect()
  const { room, user } = createRoom(owner.socket.id, 'Owner')
  room.queue = [track, nextTrack]
  room.currentTrack = track
  room.playState.revision = 2
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

  it('limits a manual skip and allows a matching conductor auto-advance with the budget exhausted', async () => {
    const { owner, room, user } = setup()
    await exhaustBudget(owner.socket)
    await owner.send(EVENTS.PLAYER_NEXT)
    expect(owner.emit).toHaveBeenCalledWith(EVENTS.ROOM_ERROR, expect.objectContaining({ code: ERROR_CODE.RATE_LIMITED }))
    expect(room.pendingPlayback).toBeFalsy()

    user.role = 'member'
    owner.emit.mockClear()
    await owner.send(EVENTS.PLAYER_NEXT, { auto: true, trackId: track.id, revision: 2 })
    expect(owner.emit).not.toHaveBeenCalled()
    expect(room.pendingPlayback?.track).toEqual(nextTrack)
  })

  it('requires the conductor identity even when an auto-next matches playback', async () => {
    const { room } = setup()
    const guest = connect()
    joinRoom(guest.socket.id, room.id, 'Guest')
    await guest.send(EVENTS.PLAYER_NEXT, { auto: true, trackId: track.id, revision: 2 })
    expect(guest.emit).toHaveBeenCalledWith(EVENTS.ROOM_ERROR, expect.objectContaining({ code: ERROR_CODE.NO_PERMISSION }))
    expect(room.pendingPlayback).toBeFalsy()
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
    const pending = room.pendingPlayback
    await owner.send(EVENTS.VOTE_CAST, { approve: true })

    expect(getActiveVote(room.id)).toBeNull()
    expect(room.pendingPlayback).toBe(pending)
    expect(broadcast).toHaveBeenCalledWith(EVENTS.VOTE_RESULT, { passed: false, action, reason: 'action_failed' })
  })
})
