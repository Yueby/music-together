import { describe, expect, it, vi } from 'vitest'
import { EVENTS, type ClientKind } from '@music-together/shared'
import type { TypedServer, TypedSocket } from '../middleware/types.js'
import { AdmissionQueue } from './admissionQueueService.js'

function createMockSocket(id: string, identityUserId: string, clientKind: ClientKind = 'web') {
  const emitted: Array<{ event: string; args: unknown[] }> = []
  const socket = {
    id,
    connected: true,
    data: { identityUserId, clientKind },
    emit: vi.fn((event: string, ...args: unknown[]) => {
      emitted.push({ event, args })
    }),
  } as unknown as TypedSocket
  return { socket, emitted }
}

function createMockIo(sockets: TypedSocket[]) {
  const map = new Map(sockets.map((s) => [s.id, s]))
  return {
    sockets: { sockets: map },
    emit: vi.fn(),
  } as unknown as TypedServer & { sockets: { sockets: Map<string, TypedSocket> } }
}

describe('AdmissionQueue', () => {
  it('stops counting a create-restricted waiter against capacity while keeping its public reason', async () => {
    const queue = new AdmissionQueue()
    const { socket } = createMockSocket('create', 'creator')
    const io = createMockIo([socket])
    queue.setExecutor(vi.fn())
    queue.enqueue(io, socket, { action: 'create', nickname: 'Creator' }, 'capacity')
    expect(queue.hasWaitingForCapacity()).toBe(true)
    await expect(queue.drain(io, () => ({ allowed: false, reason: 'create_restricted' }))).resolves.toBe(0)
    expect(queue.hasWaitingForCapacity()).toBe(false)
    expect(socket.emit).toHaveBeenLastCalledWith(EVENTS.ADMISSION_QUEUED, expect.objectContaining({ reason: 'capacity' }))
  })

  it('enqueues in FIFO order, deduplicates per identity, and enforces maxQueueLength', () => {
    const queue = new AdmissionQueue({ maxQueueLength: 2 })
    const s1 = createMockSocket('sock-1', 'user-1', 'web')
    const s1Tab2 = createMockSocket('sock-1b', 'user-1', 'web')
    const s2 = createMockSocket('sock-2', 'user-2', 'web')
    const s3 = createMockSocket('sock-3', 'user-3', 'web')
    const io = createMockIo([s1.socket, s1Tab2.socket, s2.socket, s3.socket])

    expect(queue.enqueue(io, s1.socket, { action: 'join', roomId: 'ROOM01', nickname: 'A' }, 'capacity')).toEqual({
      ok: true,
      position: 1,
      queueLength: 1,
    })

    // Same user from a second tab replaces first tab without taking a second slot
    expect(queue.enqueue(io, s1Tab2.socket, { action: 'join', roomId: 'ROOM02', nickname: 'A' }, 'capacity')).toEqual({
      ok: true,
      position: 1,
      queueLength: 1,
    })
    expect(s1.emitted.some((e) => e.event === EVENTS.ADMISSION_CANCELLED)).toBe(true)

    expect(queue.enqueue(io, s2.socket, { action: 'create', nickname: 'B' }, 'capacity')).toEqual({
      ok: true,
      position: 2,
      queueLength: 2,
    })

    // 3rd unique user is rejected because maxQueueLength === 2
    expect(queue.enqueue(io, s3.socket, { action: 'create', nickname: 'C' }, 'capacity')).toEqual({ ok: false })
  })

  it('lets a web user behind a stream-blocked mini-app user proceed during drain', async () => {
    const queue = new AdmissionQueue({ maxQueueLength: 10 })
    const mappUser = createMockSocket('sock-mapp', 'mapp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'mapp')
    const webUser = createMockSocket('sock-web', 'web-user-1', 'web')
    const io = createMockIo([mappUser.socket, webUser.socket])

    const executed: string[] = []
    queue.setExecutor((_io, socket) => {
      executed.push(socket.data.identityUserId)
    })

    queue.enqueue(io, mappUser.socket, { action: 'join', roomId: 'ROOM01', nickname: 'M' }, 'mapp_stream')
    queue.enqueue(io, webUser.socket, { action: 'join', roomId: 'ROOM01', nickname: 'W' }, 'capacity')

    const admitted = await queue.drain(io, (kind) =>
      kind === 'mapp' ? { allowed: false, reason: 'mapp_stream' } : { allowed: true },
    )

    expect(admitted).toBe(1)
    expect(executed).toEqual(['web-user-1'])
    expect(queue.length).toBe(1)
    expect(queue.findByIdentity('mapp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')?.position).toBe(1)
  })

  it('lets web users and mini-app users in other rooms pass a room-blocked request', async () => {
    const queue = new AdmissionQueue()
    const first = createMockSocket('first', 'mapp_first', 'mapp')
    const web = createMockSocket('web', 'web-user')
    const otherRoom = createMockSocket('other', 'mapp_other', 'mapp')
    const io = createMockIo([first.socket, web.socket, otherRoom.socket])
    const execute = vi.fn((_io: TypedServer, _socket: TypedSocket) => {})
    queue.setExecutor(execute)
    queue.enqueue(io, first.socket, { action: 'join', roomId: 'ROOM01', nickname: 'A' }, 'mapp_room')
    queue.enqueue(io, web.socket, { action: 'join', roomId: 'ROOM01', nickname: 'B' }, 'capacity')
    queue.enqueue(io, otherRoom.socket, { action: 'join', roomId: 'ROOM02', nickname: 'C' }, 'capacity')

    await expect(queue.drain(io, (kind, options) =>
      kind === 'mapp' && options?.targetRoomId === 'ROOM01'
        ? { allowed: false, reason: 'mapp_room' }
        : { allowed: true },
    )).resolves.toBe(2)
    expect(execute.mock.calls.map(([, socket]) => socket.id)).toEqual(['web', 'other'])
    expect(queue.findByIdentity('mapp_first')?.position).toBe(1)
    expect(queue.hasWaitingForCapacity()).toBe(false)
  })

  it('refreshes a capacity waiter whose target room is now the limiting factor', async () => {
    const queue = new AdmissionQueue()
    const mapp = createMockSocket('mapp', 'mapp_user', 'mapp')
    const io = createMockIo([mapp.socket])
    queue.setExecutor(vi.fn())
    queue.enqueue(io, mapp.socket, { action: 'join', roomId: 'ROOM01', nickname: 'M' }, 'capacity')
    expect(queue.hasWaitingForCapacity()).toBe(true)

    await expect(queue.drain(io, () => ({ allowed: false, reason: 'mapp_room' }))).resolves.toBe(0)
    expect(queue.findByIdentity('mapp_user')?.entry.reason).toBe('mapp_room')
    expect(queue.hasWaitingForCapacity()).toBe(false)
    expect(mapp.socket.emit).toHaveBeenLastCalledWith(EVENTS.ADMISSION_QUEUED, expect.objectContaining({
      reason: 'mapp_room',
      position: 1,
      queueLength: 1,
    }))
  })

  it('cancels queued joiners when their target room is deleted and shifts remaining positions', () => {
    const queue = new AdmissionQueue({ maxQueueLength: 10 })
    const s1 = createMockSocket('sock-1', 'user-1', 'web')
    const s2 = createMockSocket('sock-2', 'user-2', 'web')
    const io = createMockIo([s1.socket, s2.socket])

    queue.enqueue(io, s1.socket, { action: 'join', roomId: 'ROOM01', nickname: 'A' }, 'capacity')
    queue.enqueue(io, s2.socket, { action: 'join', roomId: 'ROOM02', nickname: 'B' }, 'capacity')

    const removed = queue.cancelForRoom(io, 'ROOM01')
    expect(removed).toBe(1)
    expect(s1.emitted.at(-1)).toEqual({
      event: EVENTS.ADMISSION_CANCELLED,
      args: [{ reason: 'room_closed', message: '目标房间已关闭' }],
    })
    expect(queue.findByIdentity('user-2')?.position).toBe(1)
  })

  it('rebinds a briefly disconnected user on reconnect and drops them after grace timeout', () => {
    vi.useFakeTimers()
    try {
      const queue = new AdmissionQueue({ maxQueueLength: 10, disconnectGraceMs: 5_000 })
      const s1 = createMockSocket('sock-1', 'user-1', 'web')
      const s1New = createMockSocket('sock-1-new', 'user-1', 'web')
      const s2 = createMockSocket('sock-2', 'user-2', 'web')
      const io = createMockIo([s1.socket, s1New.socket, s2.socket])

      queue.enqueue(io, s1.socket, { action: 'create', nickname: 'A' }, 'capacity')
      queue.enqueue(io, s2.socket, { action: 'create', nickname: 'B' }, 'capacity')

      // user-1 disconnects and reconnects before grace period -> retains slot #1
      Reflect.set(s1.socket, 'connected', false)
      queue.handleDisconnect(io, s1.socket.id, 'user-1')
      vi.advanceTimersByTime(2_000)
      queue.handleReconnect(io, s1New.socket)
      expect(queue.findByIdentity('user-1')?.entry.socketId).toBe('sock-1-new')
      expect(queue.findByIdentity('user-1')?.position).toBe(1)

      // user-2 disconnects and does NOT return -> evicted after 5s
      Reflect.set(s2.socket, 'connected', false)
      queue.handleDisconnect(io, s2.socket.id, 'user-2')
      vi.advanceTimersByTime(5_100)
      expect(queue.findByIdentity('user-2')).toBeNull()
      expect(queue.length).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('only rebinds a web request after a recorded disconnect and after the old socket disconnects', () => {
    const queue = new AdmissionQueue()
    const original = createMockSocket('original', 'user')
    const newTab = createMockSocket('new-tab', 'user')
    const io = createMockIo([original.socket, newTab.socket])
    queue.enqueue(io, original.socket, { action: 'create', nickname: 'A' }, 'capacity')
    expect(queue.hasWaitingForCapacity()).toBe(true)

    queue.handleReconnect(io, newTab.socket)
    expect(queue.findByIdentity('user')?.entry.socketId).toBe('original')

    Reflect.set(original.socket, 'connected', false)
    queue.handleReconnect(io, newTab.socket)
    expect(queue.findByIdentity('user')?.entry.socketId).toBe('original')
    expect(queue.hasWaitingForCapacity()).toBe(false)

    Reflect.set(original.socket, 'connected', true)
    queue.handleDisconnect(io, 'original', 'user')
    queue.handleReconnect(io, newTab.socket)
    expect(queue.findByIdentity('user')?.entry.socketId).toBe('original')
    expect(newTab.emitted).toEqual([])
    queue.clear()
  })

  it('drops a disconnected mini-app request immediately without replaying it on reconnect', () => {
    const queue = new AdmissionQueue()
    const mapp = createMockSocket('mapp', 'mapp_user', 'mapp')
    const reconnect = createMockSocket('mapp-new', 'mapp_user', 'mapp')
    const web = createMockSocket('web', 'web-user')
    const io = createMockIo([mapp.socket, reconnect.socket, web.socket])
    queue.enqueue(io, mapp.socket, { action: 'create', nickname: 'M' }, 'mapp_stream')
    expect(queue.hasWaitingForCapacity()).toBe(false)
    queue.enqueue(io, web.socket, { action: 'create', nickname: 'W' }, 'capacity')

    queue.handleDisconnect(io, 'mapp', 'mapp_user')
    queue.handleReconnect(io, reconnect.socket)

    expect(queue.findByIdentity('mapp_user')).toBeNull()
    expect(reconnect.emitted).toEqual([])
    expect(web.socket.emit).toHaveBeenLastCalledWith(EVENTS.ADMISSION_QUEUED, expect.objectContaining({ position: 1 }))
  })

  it('notifies the queued tab when the same identity enters from another tab', () => {
    const queue = new AdmissionQueue()
    const original = createMockSocket('original', 'user')
    const io = createMockIo([original.socket])
    queue.enqueue(io, original.socket, { action: 'create', nickname: 'A' }, 'capacity')

    expect(queue.dropByIdentity(io, 'user', 'other-tab')).toBe(true)
    expect(original.socket.emit).toHaveBeenLastCalledWith(EVENTS.ADMISSION_CANCELLED, {
      reason: 'replaced',
      message: '已在其他标签页进入房间',
    })
  })

  it('restarts the drain when an earlier entry is cancelled during execution', async () => {
    const queue = new AdmissionQueue()
    const first = createMockSocket('first', 'mapp_user', 'mapp')
    const second = createMockSocket('second', 'second-user')
    const third = createMockSocket('third', 'third-user')
    const io = createMockIo([first.socket, second.socket, third.socket])
    queue.enqueue(io, first.socket, { action: 'create', nickname: 'A' }, 'mapp_stream')
    queue.enqueue(io, second.socket, { action: 'create', nickname: 'B' }, 'capacity')
    queue.enqueue(io, third.socket, { action: 'create', nickname: 'C' }, 'capacity')
    const execute = vi.fn(async (_io: TypedServer, socket: TypedSocket) => {
      if (socket.id === 'second') {
        await Promise.resolve()
        queue.cancelByIdentity(io, 'mapp_user', 'user')
      }
    })
    queue.setExecutor(execute)

    await expect(queue.drain(io, (kind) =>
      kind === 'mapp' ? { allowed: false, reason: 'mapp_stream' } : { allowed: true },
    )).resolves.toBe(2)
    expect(execute.mock.calls.map(([, socket]) => socket.id)).toEqual(['second', 'third'])
    expect(queue.length).toBe(0)
  })

  it('updates remaining positions after removing a stale entry without admitting anyone', async () => {
    const queue = new AdmissionQueue()
    const stale = createMockSocket('stale', 'first-user')
    const waiting = createMockSocket('waiting', 'second-user')
    const io = createMockIo([stale.socket, waiting.socket])
    queue.enqueue(io, stale.socket, { action: 'create', nickname: 'A' }, 'capacity')
    queue.enqueue(io, waiting.socket, { action: 'create', nickname: 'B' }, 'capacity')
    io.sockets.sockets.delete('stale')
    queue.setExecutor(vi.fn())

    await expect(queue.drain(io, () => ({ allowed: false, reason: 'capacity' }))).resolves.toBe(0)
    expect(queue.length).toBe(1)
    expect(waiting.socket.emit).toHaveBeenLastCalledWith(
      EVENTS.ADMISSION_QUEUED, expect.objectContaining({ position: 1, queueLength: 1 }),
    )
  })

  it('cancels a request after 30 minutes even while capacity is full', async () => {
    vi.useFakeTimers()
    try {
      const queue = new AdmissionQueue()
      const waiting = createMockSocket('waiting', 'user')
      const io = createMockIo([waiting.socket])
      queue.setExecutor(vi.fn())
      queue.enqueue(io, waiting.socket, { action: 'create', nickname: 'A' }, 'capacity')
      vi.advanceTimersByTime(30 * 60_000)

      await expect(queue.drain(io, () => ({ allowed: false, reason: 'capacity' }))).resolves.toBe(0)
      expect(queue.length).toBe(0)
      expect(waiting.socket.emit).toHaveBeenLastCalledWith(EVENTS.ADMISSION_CANCELLED, {
        reason: 'expired',
        message: '排队等候已超时，请重新尝试',
      })
    } finally {
      vi.useRealTimers()
    }
  })
})
