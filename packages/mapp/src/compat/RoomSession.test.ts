import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EVENTS, type ClientToServerEvents, type RoomState, type ServerToClientEvents } from '@music-together/shared'
import type { SdkRoomSocket } from '../../../client/src/lib/platform/SdkRoomSocket.ts'
import { createMappRoomSocket } from './roomSocket.ts'
import { createMappRoomSession, type MappRoomSession, type MappRoomSessionSnapshot } from './RoomSession.ts'

vi.mock('./roomSocket.ts', () => ({ createMappRoomSocket: vi.fn() }))

type Listener = (...args: never[]) => void
class FakeSocket {
  connected = false
  id: string | undefined
  listeners = new Map<string, Set<Listener>>()
  connect = vi.fn(() => this)
  disconnect = vi.fn(() => {
    this.connected = false
    this.id = undefined
    return this
  })
  emit = vi.fn((event: keyof ClientToServerEvents, ...args: unknown[]) => {
    if (!this.connected) throw new Error('private offline detail')
    return { event, args }
  })
  on(event: string, listener: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(listener)
    return this
  }
  off(event: string, listener: Listener) {
    this.listeners.get(event)?.delete(listener)
    return this
  }
  fire(event: string, ...args: unknown[]) {
    for (const listener of [...(this.listeners.get(event) ?? [])]) listener(...(args as never[]))
  }
  server<E extends keyof ServerToClientEvents>(event: E, ...args: Parameters<ServerToClientEvents[E]>) {
    this.fire(event, ...args)
  }
  open(id = 'socket-1') {
    this.connected = true
    this.id = id
    this.fire('connect')
  }
  identity(userId = 'platform-user') {
    this.server(EVENTS.IDENTITY_READY, { userId })
  }
  drop() {
    this.connected = false
    this.id = undefined
    this.fire('disconnect', 'private close reason')
  }
  sent(event: keyof ClientToServerEvents) {
    return this.emit.mock.calls.filter(([name]) => name === event)
  }
}

const options = {
  endpoint: 'room_socket',
  reviewedEndpointUrl: 'wss://music.example.test/socket.io/?EIO=4&transport=websocket',
}
const nickname = 'same-as-web-owner'
function room(id = 'room-a'): RoomState {
  return {
    id,
    name: 'Room',
    creatorId: 'web-user',
    hostId: 'web-user',
    conductorSocketId: 'real-socket',
    hasPassword: true,
    password: 'private-room-password',
    audioQuality: 128,
    users: [],
    queue: [],
    currentTrack: null,
    playState: { isPlaying: true, currentTime: 42, serverTimestamp: 100, revision: 3 },
    playMode: 'sequential',
    queueMode: 'keep',
  }
}
function ticket(roomId = 'room-a', expiresAt = Date.now() + 60_000) {
  return { roomId, token: `opaque-private-ticket-${roomId}`, expiresAt }
}
let fake: FakeSocket
let session: MappRoomSession
let changes: ReturnType<typeof vi.fn<(snapshot: MappRoomSessionSnapshot) => void>>
function ready() {
  fake.open()
  fake.identity()
}
function join(roomId = 'room-a') {
  expect(session.joinRoom({ roomId, nickname, password: 'private-join-password' })).toBe(true)
  fake.server(EVENTS.ROOM_STATE, room(roomId))
  fake.server(EVENTS.ROOM_REJOIN_TOKEN, ticket(roomId))
}
function reconnect(id = 'socket-2') {
  fake.drop()
  fake.open(id)
  fake.identity()
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  fake = new FakeSocket()
  changes = vi.fn()
  vi.mocked(createMappRoomSocket).mockReturnValue(fake as unknown as SdkRoomSocket)
  session = createMappRoomSession({ ...options, timeoutMs: 5000, onChange: changes })
})
afterEach(() => {
  session.dispose()
  vi.useRealTimers()
})

describe('Mapp room session', () => {
  it('creates an opt-in socket and requires connection plus server identity for explicit requests', () => {
    expect(createMappRoomSocket).toHaveBeenCalledExactlyOnceWith({ ...options, timeoutMs: 5000 })
    expect(session.socket).toBe(fake)
    expect(fake.connect).not.toHaveBeenCalled()
    expect(session.snapshot.status).toBe('idle')
    expect(session.createRoom({ nickname })).toBe(false)
    expect(session.joinRoom({ roomId: 'room-a', nickname })).toBe(false)
    session.connect()
    expect(fake.connect).toHaveBeenCalledTimes(1)
    fake.open()
    expect(session.snapshot).toMatchObject({ connected: true, userId: null, status: 'awaiting_identity' })
    expect(session.joinRoom({ roomId: 'room-a', nickname })).toBe(false)
    fake.identity()
    expect(session.snapshot).toMatchObject({ status: 'ready', userId: 'platform-user' })
    expect(fake.emit).not.toHaveBeenCalled()
    session.connect()
    expect(fake.connect).toHaveBeenCalledTimes(1)
  })

  it('clears a transient connect failure once the socket is connected with a confirmed identity again', () => {
    session.connect()
    fake.fire('connect_error', new Error('transient'))
    expect(session.snapshot).toMatchObject({ connected: false, status: 'disconnected', errorCode: 'CONNECT_FAILED' })
    fake.open('socket-2')
    fake.identity()
    expect(session.snapshot).toMatchObject({ connected: true, status: 'ready', errorCode: null })
  })

  it('accepts identity before the connect callback without deriving identity from socket.id or nickname', () => {
    session.connect()
    fake.identity()
    expect(session.createRoom({ nickname })).toBe(false)
    fake.open('real-conductor-socket')
    expect(session.createRoom({ nickname, roomName: 'Together', password: 'private-create-password' })).toBe(true)
    expect(fake.sent(EVENTS.ROOM_CREATE)).toEqual([
      [
        EVENTS.ROOM_CREATE,
        {
          nickname,
          roomName: 'Together',
          password: 'private-create-password',
        },
      ],
    ])
    fake.server(EVENTS.ROOM_STATE, room('unrelated'))
    expect(session.snapshot.roomId).toBeNull()
    fake.server(EVENTS.ROOM_CREATED, { roomId: 'room-a', userId: 'not-the-platform-identity' })
    fake.server(EVENTS.ROOM_STATE, room())
    expect(session.snapshot).toMatchObject({ roomId: 'room-a', userId: 'platform-user', status: 'joined' })
    expect(fake.id).toBe('real-conductor-socket')
  })

  it('requires matching state and ticket before retaining recovery, including ticket-before-state order', () => {
    ready()
    session.joinRoom({ roomId: 'room-a', nickname })
    fake.server(EVENTS.ROOM_REJOIN_TOKEN, ticket('other-room'))
    fake.server(EVENTS.ROOM_STATE, room('other-room'))
    expect(session.snapshot.roomId).toBeNull()
    fake.server(EVENTS.ROOM_REJOIN_TOKEN, ticket())
    fake.server(EVENTS.ROOM_STATE, room())
    expect(session.snapshot.roomId).toBe('room-a')
    reconnect()
    expect(fake.sent(EVENTS.ROOM_JOIN).at(-1)).toEqual([
      EVENTS.ROOM_JOIN,
      {
        roomId: 'room-a',
        nickname,
        rejoinToken: ticket().token,
      },
    ])
  })

  it('rejoins a confirmed created room once per new socket id and leaves playback to the original socket', () => {
    ready()
    session.createRoom({ nickname })
    fake.server(EVENTS.ROOM_CREATED, { roomId: 'room-a', userId: 'platform-user' })
    fake.server(EVENTS.ROOM_STATE, room())
    fake.server(EVENTS.ROOM_REJOIN_TOKEN, ticket())
    const playback = vi.fn()
    session.socket.on(EVENTS.PLAYER_RESUME, playback)
    session.socket.emit(EVENTS.PLAYER_SEEK, { currentTime: 15 })
    session.socket.emit(EVENTS.QUEUE_CLEAR)
    fake.drop()
    expect(() => session.socket.emit(EVENTS.PLAYER_SEEK, { currentTime: 99 })).toThrow()
    expect(() => session.socket.emit(EVENTS.QUEUE_CLEAR)).toThrow()
    fake.emit.mockClear()
    fake.open('socket-2')
    expect(fake.emit).not.toHaveBeenCalled()
    fake.identity()
    fake.identity()
    fake.fire('connect')
    expect(fake.sent(EVENTS.ROOM_JOIN)).toHaveLength(1)
    expect(session.snapshot.status).toBe('joining')
    fake.server(EVENTS.ROOM_STATE, room())
    fake.server(EVENTS.ROOM_REJOIN_TOKEN, ticket())
    fake.identity()
    fake.fire('connect')
    const sync = { playState: { ...room().playState, serverTimeToExecute: Date.now() + 100 } }
    fake.server(EVENTS.PLAYER_RESUME, sync)
    expect(playback).toHaveBeenCalledExactlyOnceWith(sync)
    expect(fake.emit.mock.calls.map(([event]) => event)).toEqual([EVENTS.ROOM_JOIN])
    reconnect('socket-3')
    expect(fake.sent(EVENTS.ROOM_JOIN)).toHaveLength(2)
  })

  it.each(['create', 'join'] as const)('does not replay an unconfirmed %s after disconnect', (kind) => {
    ready()
    if (kind === 'create') session.createRoom({ nickname })
    else session.joinRoom({ roomId: 'room-a', nickname })
    fake.server(EVENTS.ROOM_REJOIN_TOKEN, ticket())
    fake.emit.mockClear()
    reconnect()
    expect(fake.emit).not.toHaveBeenCalled()
    expect(session.snapshot.roomId).toBeNull()
  })

  it('never repeats automatic re-entry for a previously attempted socket id', () => {
    ready()
    join()
    reconnect('socket-2')
    fake.server(EVENTS.ROOM_STATE, room())
    fake.server(EVENTS.ROOM_REJOIN_TOKEN, ticket())
    reconnect('socket-2')
    fake.identity()
    expect(fake.sent(EVENTS.ROOM_JOIN)).toHaveLength(2)
    reconnect('socket-3')
    expect(fake.sent(EVENTS.ROOM_JOIN)).toHaveLength(3)
  })

  it('only forwards room request fields, not caller-supplied identity or rejoin claims', () => {
    ready()
    session.joinRoom(
      Object.assign(
        { roomId: 'room-a', nickname },
        {
          userId: 'web-owner',
          rejoinToken: 'caller-ticket',
          creatorId: 'web-owner',
        },
      ),
    )
    expect(fake.sent(EVENTS.ROOM_JOIN)).toEqual([
      [
        EVENTS.ROOM_JOIN,
        {
          roomId: 'room-a',
          nickname,
          password: undefined,
        },
      ],
    ])
    fake.server(EVENTS.ROOM_ERROR, { code: 'JOIN_FAILED', message: 'safe' })
    session.createRoom(Object.assign({ nickname }, { userId: 'web-owner', hostId: 'web-owner' }))
    expect(fake.sent(EVENTS.ROOM_CREATE)).toEqual([
      [
        EVENTS.ROOM_CREATE,
        {
          nickname,
          roomName: undefined,
          password: undefined,
        },
      ],
    ])
  })

  it('requires fresh identity on reconnect, including identity-before-connect order', () => {
    ready()
    join()
    fake.drop()
    fake.identity()
    expect(fake.sent(EVENTS.ROOM_JOIN)).toHaveLength(1)
    fake.open('socket-2')
    expect(fake.sent(EVENTS.ROOM_JOIN)).toHaveLength(2)
  })

  it('reports expired tickets and waits for a manual request without retrying', () => {
    ready()
    join()
    vi.advanceTimersByTime(60_001)
    reconnect()
    expect(session.snapshot).toMatchObject({ status: 'ready', roomId: null, errorCode: 'REJOIN_TOKEN_EXPIRED' })
    fake.identity()
    fake.fire('connect')
    reconnect('socket-3')
    expect(fake.sent(EVENTS.ROOM_JOIN)).toHaveLength(1)
    expect(session.joinRoom({ roomId: 'room-b', nickname })).toBe(true)
  })

  it('counts ticket lifetime from receipt, so a phone clock far ahead of the server still rejoins', () => {
    ready()
    session.joinRoom({ roomId: 'room-a', nickname })
    fake.server(EVENTS.ROOM_STATE, room())
    // The server stamped expiresAt 60s after ITS now, but this phone is 10 minutes ahead: already "past" locally.
    fake.server(EVENTS.ROOM_REJOIN_TOKEN, ticket('room-a', Date.now() - 9 * 60_000))
    vi.advanceTimersByTime(20_000)
    reconnect()
    expect(fake.sent(EVENTS.ROOM_JOIN).at(-1)).toEqual([
      EVENTS.ROOM_JOIN,
      { roomId: 'room-a', nickname, rejoinToken: ticket().token },
    ])
    expect(session.snapshot).toMatchObject({ status: 'joining', errorCode: null })
  })

  it('keeps a ticket issued before the room state with a skewed clock, then expires it after the default TTL', () => {
    ready()
    session.joinRoom({ roomId: 'room-a', nickname })
    fake.server(EVENTS.ROOM_REJOIN_TOKEN, ticket('room-a', Date.now() - 9 * 60_000))
    fake.server(EVENTS.ROOM_STATE, room())
    vi.advanceTimersByTime(60_001)
    reconnect()
    expect(session.snapshot).toMatchObject({ status: 'ready', roomId: null, errorCode: 'REJOIN_TOKEN_EXPIRED' })
    expect(fake.sent(EVENTS.ROOM_JOIN)).toHaveLength(1)
  })

  it('does not drop a longer server TTL early when the clock is accurate', () => {
    ready()
    session.joinRoom({ roomId: 'room-a', nickname })
    fake.server(EVENTS.ROOM_STATE, room())
    fake.server(EVENTS.ROOM_REJOIN_TOKEN, ticket('room-a', Date.now() + 300_000))
    vi.advanceTimersByTime(200_000)
    reconnect()
    expect(fake.sent(EVENTS.ROOM_JOIN)).toHaveLength(2)
  })

  it('trusts the lifetime the server sends over the clocks, even when it is longer than the default', () => {
    ready()
    session.joinRoom({ roomId: 'room-a', nickname })
    fake.server(EVENTS.ROOM_STATE, room())
    // phone 10 minutes ahead of the server, server TTL 5 minutes: stamped in the local past, yet valid for 5 minutes
    fake.server(EVENTS.ROOM_REJOIN_TOKEN, { ...ticket('room-a', Date.now() - 9 * 60_000), ttlMs: 300_000 })
    vi.advanceTimersByTime(200_000)
    reconnect()
    expect(fake.sent(EVENTS.ROOM_JOIN)).toHaveLength(2)
  })

  it('expires a ticket once the lifetime the server sent has passed', () => {
    ready()
    session.joinRoom({ roomId: 'room-a', nickname })
    fake.server(EVENTS.ROOM_STATE, room())
    fake.server(EVENTS.ROOM_REJOIN_TOKEN, { ...ticket('room-a', Date.now() + 60_000), ttlMs: 30_000 })
    vi.advanceTimersByTime(31_000)
    reconnect()
    expect(fake.sent(EVENTS.ROOM_JOIN)).toHaveLength(1)
    expect(session.snapshot.errorCode).toBe('REJOIN_TOKEN_EXPIRED')
  })

  it('does not restore a confirmed room with no ticket or an unrelated ticket', () => {
    ready()
    session.joinRoom({ roomId: 'room-a', nickname })
    fake.server(EVENTS.ROOM_STATE, room())
    fake.server(EVENTS.ROOM_REJOIN_TOKEN, ticket('other-room'))
    reconnect()
    expect(fake.sent(EVENTS.ROOM_JOIN)).toHaveLength(1)
    expect(session.snapshot.errorCode).toBe('REJOIN_TOKEN_MISSING')
  })

  it('clears recovery on identity change even when the nickname remains the same', () => {
    ready()
    join()
    fake.drop()
    fake.open('socket-2')
    fake.identity('different-platform-user')
    expect(session.snapshot).toMatchObject({
      roomId: null,
      userId: 'different-platform-user',
      status: 'ready',
      errorCode: 'IDENTITY_CHANGED',
    })
    expect(fake.sent(EVENTS.ROOM_JOIN)).toHaveLength(1)
    fake.server(EVENTS.ROOM_STATE, room())
    fake.server(EVENTS.ROOM_REJOIN_TOKEN, ticket())
    reconnect('socket-3')
    expect(fake.sent(EVENTS.ROOM_JOIN)).toHaveLength(1)
  })

  it('clears failed re-entry and never retries it on duplicate events or later connections', () => {
    ready()
    join()
    reconnect()
    fake.server(EVENTS.ROOM_ERROR, { code: 'PRIVATE_TOKEN_VALUE', message: 'private password detail' })
    expect(session.snapshot).toMatchObject({ status: 'ready', roomId: null, errorCode: 'REJOIN_FAILED' })
    fake.identity()
    fake.fire('connect')
    fake.server(EVENTS.ROOM_STATE, room())
    fake.server(EVENTS.ROOM_REJOIN_TOKEN, ticket())
    reconnect('socket-3')
    expect(fake.sent(EVENTS.ROOM_JOIN)).toHaveLength(2)
  })

  it('ignores old-room broadcasts during a new join and preserves the prior confirmed room on validation failure', () => {
    ready()
    join()
    session.joinRoom({ roomId: 'room-b', nickname, password: 'wrong-password' })
    fake.server(EVENTS.ROOM_STATE, room())
    expect(session.snapshot).toMatchObject({ status: 'joining', roomId: 'room-a' })
    expect(session.createRoom({ nickname })).toBe(false)
    expect(session.snapshot.errorCode).toBe('REQUEST_PENDING')
    fake.server(EVENTS.ROOM_ERROR, { code: 'WRONG_PASSWORD', message: 'private detail' })
    expect(session.snapshot).toMatchObject({ status: 'joined', roomId: 'room-a', errorCode: 'JOIN_FAILED' })
    reconnect()
    expect(fake.sent(EVENTS.ROOM_JOIN).at(-1)).toEqual([
      EVENTS.ROOM_JOIN,
      {
        roomId: 'room-a',
        nickname,
        rejoinToken: ticket().token,
      },
    ])
  })

  it.each(['QUEUE_FULL', 'RATE_LIMITED', 'NO_PERMISSION', 'INVALID_DATA', 'STREAM_FAILED'])(
    'does not fail a join in flight because of a late in-room error (%s)',
    (code) => {
      ready()
      join()
      session.joinRoom({ roomId: 'room-b', nickname })
      fake.server(EVENTS.ROOM_ERROR, { code, message: 'late action error' })
      expect(session.snapshot).toMatchObject({ status: 'joining', errorCode: null })
      fake.server(EVENTS.ROOM_STATE, room('room-b'))
      expect(session.snapshot).toMatchObject({ status: 'joined', roomId: 'room-b' })
    },
  )

  it.each(['ROOM_NOT_FOUND', 'WRONG_PASSWORD', 'JOIN_FAILED', 'INVALID_INPUT', 'INTERNAL'])(
    'still ends a join in flight on the entry error %s',
    (code) => {
      ready()
      join()
      session.joinRoom({ roomId: 'room-b', nickname })
      fake.server(EVENTS.ROOM_ERROR, { code, message: 'entry error' })
      expect(session.snapshot).toMatchObject({ status: 'joined', roomId: 'room-a', errorCode: 'JOIN_FAILED' })
    },
  )

  it('replaces old recovery only after the new room is confirmed and has its own ticket', () => {
    ready()
    join()
    session.joinRoom({ roomId: 'room-b', nickname })
    fake.server(EVENTS.ROOM_STATE, room('room-b'))
    fake.server(EVENTS.ROOM_REJOIN_TOKEN, ticket('room-a'))
    reconnect()
    expect(fake.sent(EVENTS.ROOM_JOIN)).toHaveLength(2)
    expect(session.snapshot.errorCode).toBe('REJOIN_TOKEN_MISSING')
  })

  it('never exposes credentials, room state, error messages, or mutable snapshots', () => {
    ready()
    join()
    const json = JSON.stringify([session.snapshot, ...changes.mock.calls.map(([value]) => value)])
    for (const secret of [
      'opaque-private-ticket',
      'private-room-password',
      'private-join-password',
      'playState',
      'queue',
    ]) {
      expect(json).not.toContain(secret)
    }
    expect(Object.keys(session.snapshot).sort()).toEqual(['connected', 'errorCode', 'roomId', 'status', 'userId'])
    expect(Object.isFrozen(session.snapshot)).toBe(true)
  })

  it.each([true, false])('manual leave clears pending and recovery, connected=%s', (connected) => {
    ready()
    join()
    if (!connected) fake.drop()
    fake.emit.mockClear()
    session.leaveRoom()
    expect(fake.sent(EVENTS.ROOM_LEAVE)).toHaveLength(connected ? 1 : 0)
    expect(session.snapshot.roomId).toBeNull()
    fake.server(EVENTS.ROOM_STATE, room())
    fake.server(EVENTS.ROOM_REJOIN_TOKEN, ticket())
    reconnect()
    expect(fake.sent(EVENTS.ROOM_JOIN)).toHaveLength(0)
  })

  it.each(['create', 'join'] as const)('ignores delayed confirmation after leaving a pending %s', (kind) => {
    ready()
    if (kind === 'create') session.createRoom({ nickname })
    else session.joinRoom({ roomId: 'room-a', nickname })
    session.leaveRoom()
    fake.server(EVENTS.ROOM_CREATED, { roomId: 'room-a', userId: 'platform-user' })
    fake.server(EVENTS.ROOM_STATE, room())
    fake.server(EVENTS.ROOM_REJOIN_TOKEN, ticket())
    expect(session.snapshot.roomId).toBeNull()
    reconnect()
    expect(fake.sent(EVENTS.ROOM_JOIN)).toHaveLength(kind === 'join' ? 1 : 0)
  })

  it('sanitizes emit failures without propagating private errors', () => {
    ready()
    fake.emit.mockImplementationOnce(() => {
      throw new Error('private credentials')
    })
    expect(session.createRoom({ nickname })).toBe(false)
    expect(session.snapshot.errorCode).toBe('CREATE_FAILED')
    expect(JSON.stringify(changes.mock.calls)).not.toContain('private')
  })

  it('offers cached immutable snapshots and independent UI subscriptions', () => {
    const initial = session.snapshot
    const snapshots: MappRoomSessionSnapshot[] = []
    const off = session.subscribe(() => snapshots.push(session.snapshot))
    expect(session.snapshot).toBe(initial)
    expect(Object.isFrozen(initial)).toBe(true)
    expect(snapshots).toEqual([])
    session.connect()
    ready()
    expect(snapshots).toEqual(changes.mock.calls.map(([snapshot]) => snapshot))
    expect(snapshots.every(Object.isFrozen)).toBe(true)
    expect(session.snapshot).toBe(snapshots.at(-1))
    expect(session.snapshot).not.toBe(initial)
    off()
    off()
    const count = snapshots.length
    fake.drop()
    expect(snapshots).toHaveLength(count)
    expect(changes.mock.calls.at(-1)?.[0].status).toBe('disconnected')
  })

  it('releases subscriptions on disposal', () => {
    const seen: string[] = []
    session.subscribe(() => seen.push(session.snapshot.status))
    session.connect()
    session.dispose()
    expect(seen).toEqual(['connecting', 'disposed'])
    const late = vi.fn()
    const off = session.subscribe(late)
    off()
    fake.open()
    expect(late).not.toHaveBeenCalled()
    expect(seen).toEqual(['connecting', 'disposed'])
    expect(fake.disconnect).toHaveBeenCalledOnce()
  })

  it('does not notify an observer removed by an earlier observer', () => {
    let removeSecond = () => {}
    session.subscribe(() => removeSecond())
    const second = vi.fn()
    removeSecond = session.subscribe(second)
    session.connect()
    expect(second).not.toHaveBeenCalled()
  })

  it('disposes idempotently, removes only its listeners and ignores captured late events', () => {
    ready()
    join()
    const ownListeners = [...fake.listeners].flatMap(([event, listeners]) =>
      [...listeners].map((listener) => ({ event, listener })),
    )
    const external = vi.fn()
    session.socket.on(EVENTS.ROOM_STATE, external)
    session.dispose()
    const final = session.snapshot
    const count = changes.mock.calls.length
    session.dispose()
    for (const { event, listener } of ownListeners) {
      const payload =
        event === EVENTS.ROOM_STATE ? room() : event === EVENTS.ROOM_REJOIN_TOKEN ? ticket() : { userId: 'late-user' }
      listener(payload as never)
    }
    session.connect()
    expect(session.createRoom({ nickname })).toBe(false)
    expect(session.joinRoom({ roomId: 'room-a', nickname })).toBe(false)
    session.leaveRoom()
    fake.server(EVENTS.ROOM_STATE, room())
    expect(external).toHaveBeenCalledTimes(1)
    expect(fake.disconnect).toHaveBeenCalledTimes(1)
    expect(session.snapshot).toBe(final)
    expect(session.snapshot.status).toBe('disposed')
    expect(changes).toHaveBeenCalledTimes(count)
    expect([...fake.listeners.values()].reduce((sum, listeners) => sum + listeners.size, 0)).toBe(1)
  })
})
