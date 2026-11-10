import { describe, expect, it, vi } from 'vitest'
import { EVENTS } from '@music-together/shared'
import type { TypedSocket } from '../../../client/src/lib/socket.ts'
import type { MappRoomSession, MappRoomSessionSnapshot } from './RoomSession.ts'
import { createMappRoomCommands } from './MappRoomCommands.ts'

type Session = Pick<MappRoomSession, 'socket' | 'snapshot' | 'createRoom' | 'joinRoom' | 'leaveRoom'>
const createInput = {
  nickname: 'Listener',
  roomName: 'Together',
  password: 'fixture-password',
  userId: 'forged-client-user',
  socketId: 'forged-client-socket',
  role: 'host',
  rejoinToken: 'untrusted-client-ticket',
}
const joinInput = { ...createInput, roomId: 'original-room' }

function fixture(patch: Partial<MappRoomSessionSnapshot> = {}) {
  const emit = vi.fn()
  const socket = { emit } as unknown as TypedSocket
  let snapshot: MappRoomSessionSnapshot = {
    status: 'ready',
    connected: true,
    userId: 'canonical-server-user',
    roomId: null,
    errorCode: null,
    ...patch,
  }
  const createRoom = vi.fn<Session['createRoom']>((input) => {
    emit(EVENTS.ROOM_CREATE, input)
    return true
  })
  const joinRoom = vi.fn<Session['joinRoom']>((input) => {
    emit(EVENTS.ROOM_JOIN, input)
    return true
  })
  const leaveRoom = vi.fn<Session['leaveRoom']>(() => { emit(EVENTS.ROOM_LEAVE) })
  const session: Session = {
    socket,
    get snapshot() { return snapshot },
    createRoom,
    joinRoom,
    leaveRoom,
  }
  return {
    socket, emit, session, createRoom, joinRoom, leaveRoom,
    commands: createMappRoomCommands(session),
    setSnapshot(patch: Partial<MappRoomSessionSnapshot>) { snapshot = { ...snapshot, ...patch } },
  }
}

describe('Mapp room commands', () => {
  it('whitelists create fields and leaves identity and credentials to the session', () => {
    const { commands, socket, session, createRoom, emit } = fixture()
    const expected = { nickname: createInput.nickname, roomName: createInput.roomName, password: createInput.password }

    expect(commands.create(socket, createInput)).toBe(true)
    expect(createRoom).toHaveBeenCalledExactlyOnceWith(expected)
    expect(emit).toHaveBeenCalledExactlyOnceWith(EVENTS.ROOM_CREATE, expected)
    expect(session.snapshot.userId).toBe('canonical-server-user')
  })

  it('whitelists join fields without forwarding client identity or rejoin tokens', () => {
    const { commands, socket, joinRoom, emit } = fixture()
    const expected = { roomId: joinInput.roomId, nickname: joinInput.nickname, password: joinInput.password }

    expect(commands.join(socket, joinInput)).toBe(true)
    expect(joinRoom).toHaveBeenCalledExactlyOnceWith(expected)
    expect(emit).toHaveBeenCalledExactlyOnceWith(EVENTS.ROOM_JOIN, expected)
  })

  it.each(['create', 'join', 'automatic join', 'leave'] as const)(
    'rejects a mismatched socket before %s can do anything',
    (operation) => {
      const { commands, session, createRoom, joinRoom, leaveRoom, emit } = fixture({ status: 'joining' })
      const otherSocket = { emit } as unknown as TypedSocket
      const snapshot = session.snapshot
      const run = () => {
        if (operation === 'create') commands.create(otherSocket, createInput)
        else if (operation === 'leave') commands.leave(otherSocket)
        else commands.join(otherSocket, joinInput, { automatic: operation === 'automatic join' })
      }

      expect(run).toThrowError(new Error('MAPP_ROOM_SOCKET_MISMATCH'))
      expect(createRoom).not.toHaveBeenCalled()
      expect(joinRoom).not.toHaveBeenCalled()
      expect(leaveRoom).not.toHaveBeenCalled()
      expect(emit).not.toHaveBeenCalled()
      expect(session.snapshot).toBe(snapshot)
    },
  )

  it.each(['joining', 'creating'] as const)(
    'waits for an authoritative %s request on automatic join without changing its snapshot',
    (status) => {
      const { commands, socket, session, createRoom, joinRoom, emit } = fixture({ status })
      const snapshot = session.snapshot

      expect(commands.join(socket, joinInput, { automatic: true })).toBe(true)
      expect(commands.join(socket, { ...joinInput, roomId: 'different-room' }, { automatic: true })).toBe(true)
      expect(createRoom).not.toHaveBeenCalled()
      expect(joinRoom).not.toHaveBeenCalled()
      expect(emit).not.toHaveBeenCalled()
      expect(session.snapshot).toBe(snapshot)
      expect(session.snapshot.errorCode).toBeNull()
    },
  )

  it('reads the current snapshot and coalesces automatic joins after the original request', () => {
    const { commands, socket, joinRoom, emit, setSnapshot } = fixture()

    expect(commands.join(socket, joinInput, { automatic: true })).toBe(true)
    setSnapshot({ status: 'joining' })
    expect(commands.join(socket, joinInput, { automatic: true })).toBe(true)
    setSnapshot({ status: 'joined', roomId: joinInput.roomId })
    expect(commands.join(socket, joinInput, { automatic: true })).toBe(true)
    expect(joinRoom).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledTimes(1)
  })

  it('delegates automatic joins to a different room without remapping its ID', () => {
    const { commands, socket, joinRoom } = fixture({ status: 'joined', roomId: 'previous-room' })

    expect(commands.join(socket, joinInput, { automatic: true })).toBe(true)
    expect(joinRoom).toHaveBeenCalledExactlyOnceWith({
      roomId: joinInput.roomId, nickname: joinInput.nickname, password: joinInput.password,
    })
  })

  it.each(['joining', 'creating', 'joined'] as const)(
    'delegates manual joins in %s to the original API without coalescing',
    (status) => {
      const { commands, socket, joinRoom, setSnapshot, session, emit } = fixture({ status, roomId: joinInput.roomId })
      joinRoom.mockImplementation(() => {
        setSnapshot({ errorCode: 'REQUEST_PENDING' })
        return false
      })

      expect(commands.join(socket, joinInput)).toBe(false)
      expect(commands.join(socket, joinInput, { automatic: false })).toBe(false)
      expect(joinRoom).toHaveBeenCalledTimes(2)
      expect(session.snapshot.errorCode).toBe('REQUEST_PENDING')
      expect(emit).not.toHaveBeenCalled()
    },
  )

  it.each(['idle', 'awaiting_identity', 'disconnected', 'disposed'] as const)(
    'preserves false from the unready %s session for create and join',
    (status) => {
      const { commands, socket, createRoom, joinRoom, emit } = fixture({ status, connected: false })
      createRoom.mockReturnValue(false)
      joinRoom.mockReturnValue(false)

      expect(commands.create(socket, createInput)).toBe(false)
      expect(commands.join(socket, joinInput)).toBe(false)
      expect(commands.join(socket, joinInput, { automatic: true })).toBe(false)
      expect(createRoom).toHaveBeenCalledTimes(1)
      expect(joinRoom).toHaveBeenCalledTimes(2)
      expect(emit).not.toHaveBeenCalled()
    },
  )

  it('delegates leave once and lets only the session emit', () => {
    const { commands, socket, leaveRoom, emit } = fixture({ status: 'joined', roomId: joinInput.roomId })

    expect(commands.leave(socket)).toBeUndefined()
    expect(leaveRoom).toHaveBeenCalledExactlyOnceWith()
    expect(emit).toHaveBeenCalledExactlyOnceWith(EVENTS.ROOM_LEAVE)
  })
})
