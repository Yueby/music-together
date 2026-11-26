import { ERROR_CODE, EVENTS, LIMITS, PROTOCOL_VERSION, TIMING } from '@music-together/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { config } from '../config.js'
import type { TypedServer, TypedSocket } from '../middleware/types.js'
import { chatRepo } from '../repositories/chatRepository.js'
import { roomRepo } from '../repositories/roomRepository.js'
import { admissionQueue } from '../services/admissionQueueService.js'
import { clearAllTimers, setShuttingDown } from '../services/roomLifecycleService.js'
import { cleanupRoomRejoinTickets } from '../services/rejoinTicketService.js'
import { canAdmitClient } from '../services/serverLoadService.js'
import { executeQueuedAdmission, registerRoomController } from './roomController.js'
import { initializeSocket } from './index.js'

vi.mock('../services/playerService.js', () => ({
  autoPlayIfEmpty: vi.fn(async () => {}),
  syncPlaybackToSocket: vi.fn(async () => {}),
  preloadUpcoming: vi.fn(async () => {}),
  cleanupRoom: vi.fn(),
  stopSafe: vi.fn(),
}))
vi.mock('../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))
vi.mock('../services/serverLoadService.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../services/serverLoadService.js')>(),
  canAdmitClient: vi.fn(() => ({ allowed: true })),
}))

type Handler = (payload?: unknown) => void | Promise<void>
type Peer = ReturnType<typeof connect>

const peers: Peer[] = []
let sequence = 0
/** Every test uses its own identities: the rate limiters keep their counters for the whole process. */
const newIdentity = (label: string) => `${label}-${++sequence}`

const sockets = new Map<string, TypedSocket>()
const io = {
  sockets: { sockets },
  to: () => ({ emit: vi.fn(), except: () => ({ emit: vi.fn() }) }),
  emit: vi.fn(),
} as unknown as TypedServer

function connect(identityUserId: string) {
  const handlers = new Map<string, Handler>()
  const emit = vi.fn()
  const socket = {
    id: `socket-${++sequence}`,
    connected: true,
    data: { identityUserId, clientIp: `2001:db8:0:${sequence.toString(16)}::1` },
    emit,
    on: (event: string, handler: Handler) => handlers.set(event, handler),
    join: vi.fn(),
    leave: vi.fn(),
    to: (roomId: string) => ({
      emit: (event: string, payload: unknown) => {
        for (const peer of peers) {
          if (peer.socket.id !== socket.id && roomRepo.getSocketMapping(peer.socket.id)?.roomId === roomId) {
            peer.emit(event, payload)
          }
        }
      },
    }),
  }
  const typedSocket = socket as unknown as TypedSocket
  sockets.set(socket.id, typedSocket)
  registerRoomController(io, typedSocket)
  const peer = { socket, handlers, emit, identityUserId }
  peers.push(peer)
  return peer
}

const send = async (peer: Peer, event: string, payload?: unknown) => {
  await peer.handlers.get(event)!.call(peer.socket, payload)
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
  sockets.clear()
  admissionQueue.clear()
  setShuttingDown(false)
  clearAllTimers()
  vi.useRealTimers()
  vi.clearAllMocks()
  vi.mocked(canAdmitClient).mockReturnValue({ allowed: true })
})

describe('room admission', () => {
  it('queues a mini-app room switch at the room limit and lets a Web switch proceed', async () => {
    const sourceRoom = await createRoom(connect(newIdentity('source')))
    const targetRoom = await createRoom(connect(newIdentity('target')))
    const mapp = connect(`mapp_${newIdentity('guest')}`)
    const web = connect(newIdentity('web'))
    await send(mapp, EVENTS.ROOM_JOIN, { roomId: sourceRoom, nickname: 'Mini-app guest' })
    await send(web, EVENTS.ROOM_JOIN, { roomId: sourceRoom, nickname: 'Web guest' })
    vi.mocked(canAdmitClient).mockClear()
    vi.mocked(canAdmitClient).mockReturnValue({ allowed: false, reason: 'mapp_room' })

    await send(mapp, EVENTS.ROOM_JOIN, { roomId: targetRoom, nickname: 'Mini-app guest' })
    await send(web, EVENTS.ROOM_JOIN, { roomId: targetRoom, nickname: 'Web guest' })

    expect(canAdmitClient).toHaveBeenCalledExactlyOnceWith('mapp', {
      isCreate: false, targetRoomId: targetRoom, roomSwitch: true,
    })
    expect(lastEmitted(mapp, EVENTS.ADMISSION_QUEUED)).toMatchObject({ roomId: targetRoom, reason: 'mapp_room' })
    expect(isMember(sourceRoom, mapp.identityUserId)).toBe(true)
    expect(isMember(targetRoom, mapp.identityUserId)).toBe(false)
    expect(isMember(targetRoom, web.identityUserId)).toBe(true)
    expect(emitted(web, EVENTS.ADMISSION_QUEUED)).toHaveLength(0)

    admissionQueue.setExecutor(executeQueuedAdmission)
    await admissionQueue.drain(io, () => ({ allowed: true }))
    expect(isMember(sourceRoom, mapp.identityUserId)).toBe(false)
    expect(isMember(targetRoom, mapp.identityUserId)).toBe(true)
  })

  it.each([
    [EVENTS.ROOM_JOIN, 'join'],
    [EVENTS.ROOM_CREATE, 'create'],
  ] as const)('queues %s at capacity and keeps later requests behind it', async (event, action) => {
    const roomId = await createRoom(connect(newIdentity('owner')))
    const first = connect(newIdentity('first'))
    const second = connect(newIdentity('second'))
    const payload = { nickname: 'Guest', ...(action === 'join' ? { roomId } : {}) }
    vi.mocked(canAdmitClient).mockReturnValueOnce({ allowed: false, reason: 'capacity' })

    await send(first, event, payload)
    await send(second, event, payload)

    expect(lastEmitted(first, EVENTS.ADMISSION_QUEUED)).toMatchObject({ position: 1, action, reason: 'capacity' })
    expect(lastEmitted(second, EVENTS.ADMISSION_QUEUED)).toMatchObject({ position: 2, action, reason: 'capacity' })
    expect(roomRepo.getAllIds()).toEqual([roomId])
    expect(roomRepo.getSocketMapping(first.socket.id)).toBeFalsy()
    expect(roomRepo.getSocketMapping(second.socket.id)).toBeFalsy()
  })

  it('allows a Web join when only the mini-app stream pool has waiters', async () => {
    const roomId = await createRoom(connect(newIdentity('owner')))
    const mapp = connect(`mapp_${newIdentity('guest')}`)
    const web = connect(newIdentity('web'))
    vi.mocked(canAdmitClient).mockReturnValueOnce({ allowed: false, reason: 'mapp_stream' })

    await send(mapp, EVENTS.ROOM_JOIN, { roomId, nickname: 'Mini-app guest' })
    await send(web, EVENTS.ROOM_JOIN, { roomId, nickname: 'Web guest' })

    expect(lastEmitted(mapp, EVENTS.ADMISSION_QUEUED)).toMatchObject({ reason: 'mapp_stream' })
    expect(isMember(roomId, web.identityUserId)).toBe(true)
    expect(emitted(web, EVENTS.ADMISSION_QUEUED)).toHaveLength(0)
  })

  it('allows an existing member and a valid rejoin ticket to bypass a full server and its queue', async () => {
    const roomId = await createRoom(connect(newIdentity('owner')), 'secret')
    const identity = newIdentity('member')
    const member = connect(identity)
    await send(member, EVENTS.ROOM_JOIN, { roomId, nickname: 'Guest', password: 'secret' })
    const { token } = lastEmitted(member, EVENTS.ROOM_REJOIN_TOKEN) as { token: string }
    const waiting = connect(newIdentity('waiting'))
    vi.mocked(canAdmitClient).mockReturnValue({ allowed: false, reason: 'capacity' })
    await send(waiting, EVENTS.ROOM_JOIN, { roomId, nickname: 'Waiting', password: 'secret' })

    const otherTab = connect(identity)
    await send(otherTab, EVENTS.ROOM_JOIN, { roomId, nickname: 'Guest' })
    expect(lastEmitted(otherTab, EVENTS.ROOM_STATE)).toMatchObject({ id: roomId })
    expect(emitted(otherTab, EVENTS.ADMISSION_QUEUED)).toHaveLength(0)
    await send(member, 'disconnect', 'transport close')
    await send(otherTab, 'disconnect', 'transport close')
    expect(isMember(roomId, identity)).toBe(false)

    const returning = connect(identity)
    await send(returning, EVENTS.ROOM_JOIN, { roomId, nickname: 'Guest', rejoinToken: token })
    expect(lastEmitted(returning, EVENTS.ROOM_STATE)).toMatchObject({ id: roomId })
    expect(emitted(returning, EVENTS.ADMISSION_QUEUED)).toHaveLength(0)
    expect(admissionQueue.length).toBe(1)
  })
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

  it('enforces the room-wide limit when joins arrive concurrently across identities and IPs', async () => {
    const roomId = await createRoom(connect(newIdentity('owner')), 'secret')
    const guests = Array.from({ length: 35 }, () => connect(newIdentity('guest')))
    await Promise.all(guests.map((guest) => guessWrong(guest, roomId, 1)))

    const messages = guests.map((guest) => lastError(guest)?.message)
    expect(messages.filter((message) => message === '密码错误')).toHaveLength(30)
    expect(messages.filter((message) => message === '房间密码错误次数过多，请稍后再试')).toHaveLength(5)

    const lateGuest = connect(newIdentity('late-guest'))
    await send(lateGuest, EVENTS.ROOM_JOIN, { roomId, nickname: 'Late guest', password: 'secret' })
    expect(lastError(lateGuest)).toMatchObject({ message: '房间密码错误次数过多，请稍后再试' })
    expect(isMember(roomId, lateGuest.identityUserId)).toBe(false)
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
    vi.useFakeTimers()
    const owner = connect(newIdentity('owner'))
    const roomId = await createRoom(owner, 'secret')
    const identity = newIdentity('returning')
    const first = connect(identity)
    const originalTtl = config.rejoin.ttlMs
    Object.assign(config.rejoin, { ttlMs: 2 * TIMING.ROOM_GRACE_PERIOD_MS })
    try {
      await send(first, EVENTS.ROOM_JOIN, { roomId, nickname: 'Guest', password: 'secret' })
    } finally {
      Object.assign(config.rejoin, { ttlMs: originalTtl })
    }
    const { token } = lastEmitted(first, EVENTS.ROOM_REJOIN_TOKEN) as { token: string }
    // The configurable ticket outlasts the returning-member entry.
    await send(first, 'disconnect', 'transport close')
    expect(isMember(roomId, identity)).toBe(false)
    vi.advanceTimersByTime(TIMING.ROOM_GRACE_PERIOD_MS + 1)

    const again = connect(identity)
    await guessWrong(again, roomId, max)
    await send(again, EVENTS.ROOM_JOIN, { roomId, nickname: 'Guest', password: 'secret' })
    expect(lastError(again)).toMatchObject({ message: '密码错误次数过多，请稍后再试' })

    await send(again, EVENTS.ROOM_JOIN, { roomId, nickname: 'Guest', rejoinToken: token })
    expect(isMember(roomId, identity)).toBe(true)
    expect(emitted(again, EVENTS.ROOM_STATE)).toHaveLength(1)
  })
})

describe('returning members', () => {
  it('broadcasts a returning member after a disconnect and skips the duplicate join message', async () => {
    vi.useFakeTimers()
    const owner = connect(newIdentity('owner'))
    const roomId = await createRoom(owner, 'secret')
    const guest = connect(newIdentity('guest'))
    await send(guest, EVENTS.ROOM_JOIN, { roomId, nickname: 'Guest', password: 'secret' })
    vi.advanceTimersByTime(TIMING.ROOM_GRACE_PERIOD_MS + 1)
    await send(guest, 'disconnect', 'transport close')
    expect(roomRepo.get(roomId)?.returningMembers?.has(guest.identityUserId)).toBe(true)
    owner.emit.mockClear()

    const returning = connect(guest.identityUserId)
    await send(returning, EVENTS.ROOM_JOIN, { roomId, nickname: 'Guest' })
    expect(isMember(roomId, guest.identityUserId)).toBe(true)
    expect(emitted(owner, EVENTS.ROOM_USER_JOINED)).toEqual([
      expect.objectContaining({ id: guest.identityUserId, nickname: 'Guest' }),
    ])
    expect(chatRepo.getHistory(roomId).filter((message) => message.content === 'Guest 加入了房间')).toHaveLength(1)

    const { token } = lastEmitted(returning, EVENTS.ROOM_REJOIN_TOKEN) as { token: string }
    await send(returning, EVENTS.ROOM_LEAVE)
    expect(roomRepo.get(roomId)?.returningMembers?.has(guest.identityUserId)).toBe(false)
    const afterExplicitLeave = connect(guest.identityUserId)
    await send(afterExplicitLeave, EVENTS.ROOM_JOIN, { roomId, nickname: 'Guest', rejoinToken: token })
    expect(lastError(afterExplicitLeave)).toMatchObject({ code: ERROR_CODE.WRONG_PASSWORD })
  })

  it('notifies the first member to rejoin a restored room when the second member rejoins', async () => {
    const owner = connect(newIdentity('owner'))
    const guest = connect(newIdentity('guest'))
    const roomId = await createRoom(owner, 'secret')
    const room = roomRepo.get(roomId)!
    const departedAt = Date.now()
    const expiresAt = departedAt + TIMING.ROOM_GRACE_PERIOD_MS
    room.users = []
    room.conductorSocketId = null
    room.awaitingFirstJoin = true
    room.returningMembers = new Map([
      [owner.identityUserId, { nickname: 'Owner', departedAt, expiresAt }],
      [guest.identityUserId, { nickname: 'Guest', departedAt, expiresAt }],
    ])
    roomRepo.deleteSocketMapping(owner.socket.id)

    await send(owner, EVENTS.ROOM_JOIN, { roomId, nickname: 'Owner' })
    expect(lastEmitted(owner, EVENTS.ROOM_STATE)).toMatchObject({ users: [{ id: owner.identityUserId }] })
    await send(guest, EVENTS.ROOM_JOIN, { roomId, nickname: 'Guest' })

    expect(emitted(owner, EVENTS.ROOM_USER_JOINED)).toEqual([
      expect.objectContaining({ id: guest.identityUserId, nickname: 'Guest' }),
    ])
    expect(chatRepo.getHistory(roomId).filter((message) => message.content.endsWith('加入了房间'))).toEqual([])
  })

  it.each(['password change', 'admin downgrade'])('revokes disconnected members after %s', async (change) => {
    const owner = connect(newIdentity('owner'))
    const roomId = await createRoom(owner, 'secret')
    const guest = connect(newIdentity('guest'))
    await send(guest, EVENTS.ROOM_JOIN, { roomId, nickname: 'Guest', password: 'secret' })
    const { token } = lastEmitted(guest, EVENTS.ROOM_REJOIN_TOKEN) as { token: string }
    if (change === 'admin downgrade') {
      await send(owner, EVENTS.ROOM_SET_ROLE, { userId: guest.identityUserId, role: 'admin' })
    }
    await send(guest, 'disconnect', 'transport close')

    if (change === 'admin downgrade') {
      await send(owner, EVENTS.ROOM_SET_ROLE, { userId: guest.identityUserId, role: 'member' })
    } else {
      await send(owner, EVENTS.ROOM_SETTINGS, { password: 'new-secret' })
    }
    const returning = connect(guest.identityUserId)
    await send(returning, EVENTS.ROOM_JOIN, { roomId, nickname: 'Guest', rejoinToken: token })
    expect(lastError(returning)).toMatchObject({ code: ERROR_CODE.WRONG_PASSWORD })
  })
})

describe('server lifecycle', () => {
  it('announces the version, build ID and protocol to a new socket', () => {
    const peer = connect(newIdentity('hello'))
    const server = { ...io, on: (_event: string, handler: (socket: TypedSocket) => void) => {
      handler(peer.socket as unknown as TypedSocket)
    } }
    initializeSocket(server as unknown as TypedServer)
    expect(emitted(peer, EVENTS.SERVER_HELLO)).toEqual([
      { version: config.version, buildId: config.buildId, protocol: PROTOCOL_VERSION },
    ])
  })

  it('cleans up the mapping without leaving during shutdown and rejects create and join', async () => {
    const owner = connect(newIdentity('owner'))
    const roomId = await createRoom(owner)
    const guest = connect(newIdentity('guest'))
    await send(guest, EVENTS.ROOM_JOIN, { roomId, nickname: 'Guest' })
    const history = [...chatRepo.getHistory(roomId)]
    setShuttingDown(true)

    await send(owner, 'disconnect', 'server shutting down')
    expect(roomRepo.getSocketMapping(owner.socket.id)).toBeUndefined()
    expect(roomRepo.get(roomId)).toMatchObject({ hostId: owner.identityUserId, users: expect.arrayContaining([
      expect.objectContaining({ id: owner.identityUserId, role: 'owner' }),
    ]) })
    expect(chatRepo.getHistory(roomId)).toEqual(history)

    const newcomer = connect(newIdentity('newcomer'))
    for (const event of [EVENTS.ROOM_CREATE, EVENTS.ROOM_JOIN]) {
      await send(newcomer, event, { roomId, nickname: 'Newcomer' })
      expect(lastError(newcomer)).toMatchObject({ code: ERROR_CODE.SERVER_RESTARTING })
    }
    expect(roomRepo.getAllIds()).toEqual([roomId])
    expect(roomRepo.getSocketMapping(newcomer.socket.id)).toBeUndefined()
  })
})
