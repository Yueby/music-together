import { ERROR_CODE, EVENTS, LIMITS } from '@music-together/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TypedServer, TypedSocket } from '../middleware/types.js'
import { chatRepo } from '../repositories/chatRepository.js'
import { roomRepo } from '../repositories/roomRepository.js'
import { clearAllTimers } from '../services/roomLifecycleService.js'
import { cleanupRoomRejoinTickets } from '../services/rejoinTicketService.js'
import { registerRoomController } from './roomController.js'

vi.mock('../services/playerService.js', () => ({
  autoPlayIfEmpty: vi.fn(async () => {}),
  syncPlaybackToSocket: vi.fn(async () => {}),
  preloadUpcoming: vi.fn(async () => {}),
  cleanupRoom: vi.fn(),
  stopSafe: vi.fn(),
}))
vi.mock('../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))

type Handler = (payload?: unknown) => void | Promise<void>
type Peer = ReturnType<typeof connect>

const peers: Peer[] = []
let sequence = 0
/** Every test uses its own identities: the rate limiters keep their counters for the whole process. */
const newIdentity = (label: string) => `${label}-${++sequence}`

const io = {
  to: () => ({ emit: vi.fn(), except: () => ({ emit: vi.fn() }) }),
  emit: vi.fn(),
} as unknown as TypedServer

function connect(identityUserId: string) {
  const handlers = new Map<string, Handler>()
  const emit = vi.fn()
  const socket = {
    id: `socket-${++sequence}`,
    data: { identityUserId },
    emit,
    on: (event: string, handler: Handler) => handlers.set(event, handler),
    join: vi.fn(),
    leave: vi.fn(),
    to: () => ({ emit: vi.fn() }),
  }
  registerRoomController(io, socket as unknown as TypedSocket)
  const peer = { socket, handlers, emit, identityUserId }
  peers.push(peer)
  return peer
}

const send = async (peer: Peer, event: string, payload?: unknown) => {
  await peer.handlers.get(event)!(payload)
}
const emitted = (peer: Peer, event: string) => peer.emit.mock.calls.filter(([name]) => name === event).map(([, p]) => p)
const lastEmitted = (peer: Peer, event: string) => emitted(peer, event).at(-1) as Record<string, unknown> | undefined
const lastError = (peer: Peer) => lastEmitted(peer, EVENTS.ROOM_ERROR)

async function createRoom(peer: Peer, password?: string) {
  await send(peer, EVENTS.ROOM_CREATE, { nickname: 'Owner', roomName: 'Fixture room', password })
  return (lastEmitted(peer, EVENTS.ROOM_CREATED) as { roomId: string }).roomId
}

const isMember = (roomId: string, identity: string) =>
  roomRepo.get(roomId)?.users.some((user) => user.id === identity) ?? false

afterEach(() => {
  for (const id of roomRepo.getAllIds()) {
    cleanupRoomRejoinTickets(id)
    roomRepo.delete(id)
    chatRepo.deleteRoom(id)
  }
  for (const peer of peers) roomRepo.deleteSocketMapping(peer.socket.id)
  peers.length = 0
  clearAllTimers()
  vi.clearAllMocks()
})

describe('reading the room list is rate limited', () => {
  it('answers a burst of requests only up to the budget, and drops the rest without an error', async () => {
    const peer = connect(newIdentity('lister'))
    for (let i = 0; i < 30; i++) await send(peer, EVENTS.ROOM_LIST)

    expect(emitted(peer, EVENTS.ROOM_LIST_UPDATE)).toHaveLength(20)
    expect(emitted(peer, EVENTS.ROOM_ERROR)).toHaveLength(0)
  })

  it('shares the budget between the connections of one identity', async () => {
    const identity = newIdentity('lister')
    const [tabA, tabB] = [connect(identity), connect(identity)]
    for (let i = 0; i < 20; i++) await send(tabA, EVENTS.ROOM_LIST)

    await send(tabB, EVENTS.ROOM_LIST)
    expect(emitted(tabB, EVENTS.ROOM_LIST_UPDATE)).toHaveLength(0)
  })
})

describe('entering rooms is rate limited', () => {
  it('answers ROOM_ENTRY_LIMITED to ROOM_CREATE once an identity has asked too often', async () => {
    const peer = connect(newIdentity('spammer'))
    for (let i = 0; i < 10; i++) await send(peer, EVENTS.ROOM_CREATE, {})
    expect(lastError(peer)).toMatchObject({ code: ERROR_CODE.INVALID_INPUT })

    await send(peer, EVENTS.ROOM_CREATE, { nickname: 'Owner' })
    expect(lastError(peer)).toMatchObject({ code: ERROR_CODE.ROOM_ENTRY_LIMITED })
    expect(emitted(peer, EVENTS.ROOM_CREATED)).toHaveLength(0)
    expect(roomRepo.getAllIds()).toHaveLength(0)
  })

  it('answers ROOM_ENTRY_LIMITED to ROOM_JOIN once an identity has asked too often, whatever the room', async () => {
    const owner = connect(newIdentity('owner'))
    const roomId = await createRoom(owner)
    const guest = connect(newIdentity('guest'))
    for (let i = 0; i < 10; i++) await send(guest, EVENTS.ROOM_JOIN, { roomId: 'NOPE00', nickname: 'Guest' })
    expect(lastError(guest)).toMatchObject({ code: ERROR_CODE.ROOM_NOT_FOUND })

    await send(guest, EVENTS.ROOM_JOIN, { roomId, nickname: 'Guest' })
    expect(lastError(guest)).toMatchObject({ code: ERROR_CODE.ROOM_ENTRY_LIMITED })
    expect(isMember(roomId, guest.identityUserId)).toBe(false)
  })

  it('shares the budget between the tabs of one identity', async () => {
    const identity = newIdentity('tabs')
    const tabA = connect(identity)
    const tabB = connect(identity)
    for (let i = 0; i < 10; i++) await send(tabA, EVENTS.ROOM_JOIN, { roomId: 'NOPE00', nickname: 'Me' })
    await send(tabB, EVENTS.ROOM_JOIN, { roomId: 'NOPE00', nickname: 'Me' })
    expect(lastError(tabB)).toMatchObject({ code: ERROR_CODE.ROOM_ENTRY_LIMITED })
  })
})

describe('rooms one identity may have created', () => {
  const max = LIMITS.ROOM_MAX_CREATED_PER_IDENTITY

  it('refuses the room after the limit, without taking the user out of the room they are in', async () => {
    const identity = newIdentity('collector')
    const peer = connect(identity)
    let lastRoomId = ''
    for (let i = 0; i < max; i++) lastRoomId = await createRoom(peer)
    expect(roomRepo.getAllIds()).toHaveLength(max)

    await send(peer, EVENTS.ROOM_CREATE, { nickname: 'Owner', roomName: 'One too many' })

    expect(lastError(peer)).toMatchObject({ code: ERROR_CODE.ROOM_ENTRY_LIMITED })
    expect(emitted(peer, EVENTS.ROOM_CREATED)).toHaveLength(max)
    expect(roomRepo.getAllIds()).toHaveLength(max)
    expect(roomRepo.getSocketMapping(peer.socket.id)?.roomId).toBe(lastRoomId)
    expect(isMember(lastRoomId, identity)).toBe(true)
  })

  it('counts rooms per identity, so someone else can still create one', async () => {
    const collector = connect(newIdentity('collector'))
    for (let i = 0; i < max; i++) await createRoom(collector)

    const other = connect(newIdentity('other'))
    await createRoom(other)
    expect(emitted(other, EVENTS.ROOM_CREATED)).toHaveLength(1)
    expect(roomRepo.getAllIds()).toHaveLength(max + 1)
  })

  it('allows a room again once one of them is gone', async () => {
    const peer = connect(newIdentity('collector'))
    const rooms: string[] = []
    for (let i = 0; i < max; i++) rooms.push(await createRoom(peer))
    roomRepo.delete(rooms[0])

    await createRoom(peer)
    expect(emitted(peer, EVENTS.ROOM_CREATED)).toHaveLength(max + 1)
  })
})

describe('guessing a room password', () => {
  const max = LIMITS.ROOM_JOIN_PASSWORD_MAX_FAILURES
  async function guessWrong(guest: Peer, roomId: string, times: number) {
    for (let i = 0; i < times; i++) {
      await send(guest, EVENTS.ROOM_JOIN, { roomId, nickname: 'Guest', password: `no-${i}` })
    }
  }

  it('keeps answering WRONG_PASSWORD for a wrong guess, as before', async () => {
    const roomId = await createRoom(connect(newIdentity('owner')), 'secret')
    const guest = connect(newIdentity('guest'))
    await guessWrong(guest, roomId, 1)
    expect(lastError(guest)).toMatchObject({ code: ERROR_CODE.WRONG_PASSWORD, message: '密码错误' })
  })

  it('ignores every password after too many wrong ones, even the right one', async () => {
    const roomId = await createRoom(connect(newIdentity('owner')), 'secret')
    const guest = connect(newIdentity('guest'))
    await guessWrong(guest, roomId, max)

    await send(guest, EVENTS.ROOM_JOIN, { roomId, nickname: 'Guest', password: 'secret' })

    expect(lastError(guest)).toMatchObject({
      code: ERROR_CODE.WRONG_PASSWORD,
      message: '密码错误次数过多，请稍后再试',
    })
    expect(isMember(roomId, guest.identityUserId)).toBe(false)
  })

  it('only locks out the identity (and the room) that guessed', async () => {
    const roomId = await createRoom(connect(newIdentity('owner')), 'secret')
    const otherRoomId = await createRoom(connect(newIdentity('owner2')), 'secret')
    const guesser = connect(newIdentity('guesser'))
    await guessWrong(guesser, roomId, max)

    const friend = connect(newIdentity('friend'))
    await send(friend, EVENTS.ROOM_JOIN, { roomId, nickname: 'Friend', password: 'secret' })
    expect(isMember(roomId, friend.identityUserId)).toBe(true)

    await send(guesser, EVENTS.ROOM_JOIN, { roomId: otherRoomId, nickname: 'Guesser', password: 'secret' })
    expect(isMember(otherRoomId, guesser.identityUserId)).toBe(true)
  })

  it('does not punish success: typos before the right password are forgotten', async () => {
    const owner = connect(newIdentity('owner'))
    const roomId = await createRoom(owner, 'secret')
    const guest = connect(newIdentity('guest'))

    await guessWrong(guest, roomId, max - 2)
    await send(guest, EVENTS.ROOM_JOIN, { roomId, nickname: 'Guest', password: 'secret' })
    expect(isMember(roomId, guest.identityUserId)).toBe(true)
    await send(guest, EVENTS.ROOM_LEAVE)

    // Without the reset these would add up to more than the limit.
    await guessWrong(guest, roomId, max - 1)
    await send(guest, EVENTS.ROOM_JOIN, { roomId, nickname: 'Guest', password: 'secret' })
    expect(isMember(roomId, guest.identityUserId)).toBe(true)
  })

  it('still lets a returning member in with a rejoin ticket while password guesses are locked out', async () => {
    const owner = connect(newIdentity('owner'))
    const roomId = await createRoom(owner, 'secret')
    const identity = newIdentity('returning')
    const first = connect(identity)
    await send(first, EVENTS.ROOM_JOIN, { roomId, nickname: 'Guest', password: 'secret' })
    const { token } = lastEmitted(first, EVENTS.ROOM_REJOIN_TOKEN) as { token: string }
    // The connection drops (the ticket stays valid), and from the new one wrong passwords pile up.
    await send(first, 'disconnect', 'transport close')
    expect(isMember(roomId, identity)).toBe(false)

    const again = connect(identity)
    await guessWrong(again, roomId, max)
    await send(again, EVENTS.ROOM_JOIN, { roomId, nickname: 'Guest', password: 'secret' })
    expect(lastError(again)).toMatchObject({ message: '密码错误次数过多，请稍后再试' })

    await send(again, EVENTS.ROOM_JOIN, { roomId, nickname: 'Guest', rejoinToken: token })
    expect(isMember(roomId, identity)).toBe(true)
    expect(emitted(again, EVENTS.ROOM_STATE)).toHaveLength(1)
  })
})
