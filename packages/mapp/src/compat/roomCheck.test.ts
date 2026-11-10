import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EVENTS } from '@music-together/shared'
import type { TypedSocket } from '../../../client/src/lib/socket.ts'
import type { MappRoomSession, MappRoomSessionSnapshot } from './RoomSession.ts'
import { createMappRoomCheck } from './roomCheck.ts'

type Listener = (...args: never[]) => void
class FixtureSocket {
  connected = false
  listeners = new Map<string, Set<Listener>>()
  connect = vi.fn()
  disconnect = vi.fn()
  onEmit?: () => void
  emit = vi.fn((_event: string) => { this.onEmit?.() })
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
    for (const listener of [...(this.listeners.get(event) ?? [])]) listener(...args as never[])
  }
}

const publicRoom = (id = 'room-a') => ({
  id, name: 'Empty locked room', hasPassword: true, userCount: 0,
  currentTrackTitle: null, currentTrackArtist: null,
})
const fixtures: {
  fake: FixtureSocket
  observers: Set<() => void>
  externalList: ReturnType<typeof vi.fn>
  externalDisconnect: ReturnType<typeof vi.fn>
  externalSession: ReturnType<typeof vi.fn>
}[] = []
function fixture(ready = false) {
  const fake = new FixtureSocket()
  const socket = fake as unknown as TypedSocket
  const externalList = vi.fn()
  const externalDisconnect = vi.fn()
  const externalSession = vi.fn()
  fake.on(EVENTS.ROOM_LIST_UPDATE, externalList)
  fake.on('disconnect', externalDisconnect)
  const observers = new Set<() => void>([externalSession])
  let onSubscribe: (() => void) | undefined
  let snapshot: MappRoomSessionSnapshot = {
    status: ready ? 'ready' : 'idle', connected: ready, userId: ready ? 'server-user' : null,
    roomId: null, errorCode: null,
  }
  fake.connected = ready
  const session: Pick<MappRoomSession, 'socket' | 'snapshot' | 'subscribe'> = {
    socket,
    get snapshot() { return snapshot },
    subscribe(listener) {
      observers.add(listener)
      onSubscribe?.()
      listener() // Deliberately exercise synchronous subscriptions on every request.
      return () => { observers.delete(listener) }
    },
  }
  const value = {
    fake, socket, session, observers, externalList, externalDisconnect, externalSession,
    onSubscribe(callback: () => void) { onSubscribe = callback },
    update(patch: Partial<MappRoomSessionSnapshot>) {
      snapshot = { ...snapshot, ...patch }
      for (const listener of [...observers]) listener()
    },
    ready() {
      fake.connected = true
      value.update({ status: 'ready', connected: true, userId: 'server-user' })
    },
    drop() {
      fake.connected = false
      fake.fire('disconnect', 'private-close-detail')
      value.update({ status: 'disconnected', connected: false, userId: null })
    },
    list(payload: unknown = [publicRoom()]) { fake.fire(EVENTS.ROOM_LIST_UPDATE, payload) },
  }
  fixtures.push(value)
  return value
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('native fetch forbidden') }))
})
afterEach(() => {
  for (const f of fixtures.splice(0)) {
    expect([...f.fake.listeners.get(EVENTS.ROOM_LIST_UPDATE)!]).toEqual([f.externalList])
    expect([...f.fake.listeners.get('disconnect')!]).toEqual([f.externalDisconnect])
    expect([...f.observers]).toEqual([f.externalSession])
    expect(f.fake.connect).not.toHaveBeenCalled()
    expect(f.fake.disconnect).not.toHaveBeenCalled()
    expect(f.fake.emit.mock.calls.every(([event]) => event === EVENTS.ROOM_LIST)).toBe(true)
  }
  expect(fetch).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('Mapp room check via public ROOM_LIST', () => {
  it('has no side effects at creation and waits for identity and both connection flags', async () => {
    const f = fixture()
    const reader = createMappRoomCheck(f.session)
    expect(f.observers.size).toBe(1)
    expect(vi.getTimerCount()).toBe(0)
    expect(f.fake.emit).not.toHaveBeenCalled()
    const result = reader(f.socket, 'room-a')
    f.list() // A broadcast before this request is sent is not a response.
    f.update({ userId: 'server-user', connected: true })
    expect(f.fake.emit).not.toHaveBeenCalled()
    f.fake.connected = true
    f.update({ connected: false })
    expect(f.fake.emit).not.toHaveBeenCalled()
    f.update({ connected: true, userId: null })
    expect(f.fake.emit).not.toHaveBeenCalled()
    f.ready()
    f.ready()
    expect(f.fake.emit).toHaveBeenCalledExactlyOnceWith(EVENTS.ROOM_LIST)
    f.list()
    await expect(result).resolves.toEqual({ name: 'Empty locked room', hasPassword: true, userCount: 0 })
    expect(f.externalList).toHaveBeenCalledTimes(2)
  })

  it('returns only primitive check fields from the full list including empty rooms', async () => {
    const f = fixture(true)
    const result = createMappRoomCheck(f.session)(f.socket, 'room-a')
    const payload = { ...publicRoom(), password: 'private-password', cookie: 'private-cookie', userId: 'private-id' }
    f.list([publicRoom('other-room'), payload])
    await expect(result).resolves.toStrictEqual({ name: payload.name, hasPassword: true, userCount: 0 })
    const info = await result
    payload.name = 'changed-after-receipt'
    expect(info?.name).toBe('Empty locked room')
    expect(f.fake.emit.mock.calls).toEqual([[EVENTS.ROOM_LIST]])
  })

  it('returns null for a missing room and accepts a public unlocked summary', async () => {
    const f = fixture(true)
    const reader = createMappRoomCheck(f.session)
    const missing = reader(f.socket, 'missing')
    f.list([publicRoom()])
    await expect(missing).resolves.toBeNull()
    const found = reader(f.socket, 'room-a')
    f.list([{ ...publicRoom(), hasPassword: false, userCount: 3 }])
    await expect(found).resolves.toEqual({ name: 'Empty locked room', hasPassword: false, userCount: 3 })
    const empty = reader(f.socket, 'room-a')
    f.list([])
    await expect(empty).resolves.toBeNull()
  })

  it('cleans up even when subscribe and emit deliver a synchronous response', async () => {
    const f = fixture(true)
    f.fake.onEmit = () => f.list()
    await expect(createMappRoomCheck(f.session)(f.socket, 'room-a')).resolves.toEqual({
      name: 'Empty locked room', hasPassword: true, userCount: 0,
    })
    expect(f.fake.emit).toHaveBeenCalledTimes(1)
    expect(f.observers.size).toBe(1)
  })

  it('supports concurrent requests and removes only each request’s listeners', async () => {
    const f = fixture(true)
    const abort = new AbortController()
    const reader = createMappRoomCheck(f.session)
    const first = reader(f.socket, 'room-a', { signal: abort.signal })
    const second = reader(f.socket, 'room-b')
    const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' })
    abort.abort()
    await rejected
    expect(f.fake.listeners.get(EVENTS.ROOM_LIST_UPDATE)?.size).toBe(2)
    f.list([publicRoom(), { ...publicRoom('room-b'), name: 'Second room' }])
    await expect(second).resolves.toEqual({ name: 'Second room', hasPassword: true, userCount: 0 })
    expect(f.fake.emit).toHaveBeenCalledTimes(2)
  })

  it.each(['request', 'lifetime'] as const)('honors %s aborts before and after sending and removes abort listeners', async (kind) => {
    for (const ready of [false, true]) {
      const f = fixture(ready)
      const request = new AbortController()
      const lifetime = new AbortController()
      const requestRemove = vi.spyOn(request.signal, 'removeEventListener')
      const lifetimeRemove = vi.spyOn(lifetime.signal, 'removeEventListener')
      const pending = createMappRoomCheck(f.session, lifetime.signal)(f.socket, 'room-a', { signal: request.signal })
      const rejected = expect(pending).rejects.toBeInstanceOf(DOMException)
      ;(kind === 'request' ? request : lifetime).abort('private-abort-reason')
      await rejected
      await expect(pending).rejects.toMatchObject({ name: 'AbortError', message: 'ROOM_CHECK_CANCELLED' })
      expect(requestRemove).toHaveBeenCalledWith('abort', expect.any(Function))
      expect(lifetimeRemove).toHaveBeenCalledWith('abort', expect.any(Function))
      f.ready()
      f.list()
      expect(f.fake.emit).toHaveBeenCalledTimes(ready ? 1 : 0)
    }
  })

  it.each(['request', 'lifetime', 'disposed'] as const)('rejects already cancelled %s without subscribing', async (kind) => {
    const f = fixture(true)
    const controller = new AbortController()
    controller.abort()
    if (kind === 'disposed') f.update({ status: 'disposed' })
    const pending = createMappRoomCheck(f.session, kind === 'lifetime' ? controller.signal : undefined)(
      f.socket, 'room-a', kind === 'request' ? { signal: controller.signal } : undefined,
    )
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(f.fake.emit).not.toHaveBeenCalled()
  })

  it.each([false, true])('aborts on session disposal, ready=%s', async (ready) => {
    const f = fixture(ready)
    const result = createMappRoomCheck(f.session)(f.socket, 'room-a')
    f.update({ status: 'disposed' })
    await expect(result).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('cleans up late unsubscribe when disposal occurs synchronously inside subscribe', async () => {
    const f = fixture()
    f.onSubscribe(() => f.update({ status: 'disposed' }))
    await expect(createMappRoomCheck(f.session)(f.socket, 'room-a')).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('uses a five second total deadline including identity waiting', async () => {
    const f = fixture()
    const result = createMappRoomCheck(f.session)(f.socket, 'room-a')
    const rejected = expect(result).rejects.toThrow('ROOM_CHECK_TIMEOUT')
    await vi.advanceTimersByTimeAsync(4999)
    expect(f.fake.emit).not.toHaveBeenCalled()
    f.ready()
    expect(f.fake.emit).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await rejected
    f.list()
    f.drop()
    f.ready()
    expect(f.fake.emit).toHaveBeenCalledTimes(1)
  })

  it('times out when identity never arrives', async () => {
    const f = fixture()
    const result = createMappRoomCheck(f.session)(f.socket, 'room-a')
    const rejected = expect(result).rejects.toThrow('ROOM_CHECK_TIMEOUT')
    await vi.advanceTimersByTimeAsync(5000)
    await rejected
    f.ready()
    expect(f.fake.emit).not.toHaveBeenCalled()
  })

  it('fails a sent request on disconnect without replaying after reconnection', async () => {
    const f = fixture(true)
    const result = createMappRoomCheck(f.session)(f.socket, 'room-a')
    f.drop()
    await expect(result).rejects.toThrow('ROOM_CHECK_DISCONNECTED')
    f.ready()
    f.list()
    expect(f.fake.emit).toHaveBeenCalledTimes(1)
    expect(f.externalDisconnect).toHaveBeenCalledTimes(1)
  })

  it('allows connection churn before sending without causing a replay', async () => {
    const f = fixture()
    const result = createMappRoomCheck(f.session)(f.socket, 'room-a')
    f.drop()
    f.ready()
    f.list()
    await expect(result).resolves.not.toBeNull()
    expect(f.fake.emit).toHaveBeenCalledTimes(1)
  })

  it('uses fixed errors for emit failure without exposing transport details', async () => {
    const f = fixture(true)
    f.fake.onEmit = () => { throw new Error('private-token-and-cookie') }
    await expect(createMappRoomCheck(f.session)(f.socket, 'room-a')).rejects.toThrow(/^ROOM_CHECK_REQUEST_FAILED$/)
  })


  it('requires strict session socket identity', async () => {
    const f = fixture(true)
    await expect(createMappRoomCheck(f.session)({} as TypedSocket, 'room-a')).rejects.toThrow(/^ROOM_CHECK_SOCKET_MISMATCH$/)
    expect(f.fake.emit).not.toHaveBeenCalled()
  })
})
