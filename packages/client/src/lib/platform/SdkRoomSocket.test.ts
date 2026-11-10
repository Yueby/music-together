import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import type { TypedSocket } from '../socket'
import {
  createSdkRoomSocket,
  createSdkRoomTransport,
  type SdkConnection,
  type SdkRoomSocketOptions,
  type SdkSocketEvents,
} from './SdkRoomSocket'

// Engine.IO captures the native constructor on import. Install the tripwire first.
const nativeWebSocket = vi.hoisted(() => {
  const constructor = vi.fn(() => {
    throw new Error('Native WebSocket must not be used')
  })
  vi.stubGlobal('WebSocket', constructor)
  return constructor
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

const OPEN = '0{"sid":"engine-id","upgrades":[],"pingInterval":60000,"pingTimeout":60000,"maxPayload":1000000}'
const TARGET = 'wss://reviewed.example/socket.io/?EIO=4&transport=websocket'
const SECRET = 'private-url?jwt=secret'

class FixtureConnection implements SdkConnection {
  readonly id = 'sdk-instance-id'
  readonly opened = deferred<void>()
  readonly ready = this.opened.promise
  readonly listeners = new Map<keyof SdkSocketEvents, Set<(value: unknown) => void>>()
  readonly subscriptions: ReturnType<typeof vi.fn>[] = []
  readonly sent: string[] = []
  readonly send = vi.fn<SdkConnection['send']>(async () => null)
  readonly close = vi.fn<SdkConnection['close']>(async () => null)
  readonly sendText = vi.fn<SdkConnection['sendText']>(async (text) => {
    this.sent.push(text)
    if (text === '40') queueMicrotask(() => this.fire('message', '40{"sid":"room-business-id"}'))
    return null
  })

  on<K extends keyof SdkSocketEvents>(event: K, listener: (value: SdkSocketEvents[K]) => void) {
    const handler = (value: unknown) => listener(value as SdkSocketEvents[K])
    const listeners = this.listeners.get(event) ?? new Set()
    this.listeners.set(event, listeners)
    listeners.add(handler)
    const unsubscribe = vi.fn(() => {
      listeners.delete(handler)
    })
    this.subscriptions.push(unsubscribe)
    return unsubscribe
  }

  fire<K extends keyof SdkSocketEvents>(event: K, value: SdkSocketEvents[K]) {
    for (const listener of this.listeners.get(event) ?? []) listener(value)
  }

  handshake() {
    this.fire('message', OPEN)
    this.opened.resolve()
  }
}

function fixture(connection = new FixtureConnection()) {
  const connect = vi.fn<SdkRoomSocketOptions['webSocket']['connect']>(async () => connection)
  const options: SdkRoomSocketOptions = {
    endpoint: 'room_socket',
    reviewedEndpointUrl: TARGET,
    webSocket: { connect },
    timeoutMs: 1000,
  }
  return { connection, connect, options }
}

const sockets: TypedSocket[] = []
const wrappers: { close(): void }[] = []

function room(options: SdkRoomSocketOptions, reconnect = false) {
  const socket = createSdkRoomSocket(options)
  socket.io.reconnection(reconnect)
  sockets.push(socket)
  return socket
}

function wrapper(options: SdkRoomSocketOptions) {
  const Transport = createSdkRoomTransport(options)
  // createSocket does not depend on Transport state; Engine.IO integration is
  // exercised separately through real io() connections below.
  const transport = Object.create(Transport.prototype) as InstanceType<typeof Transport>
  const ws = transport.createSocket(options.reviewedEndpointUrl, undefined)
  wrappers.push(ws)
  return { ws, transport }
}

async function subscribed(connection: FixtureConnection) {
  await vi.waitFor(() => expect(connection.subscriptions).toHaveLength(3))
}

async function connected(socket: TypedSocket, connection: FixtureConnection) {
  socket.connect()
  await subscribed(connection)
  connection.handshake()
  await vi.waitFor(() => expect(socket.connected).toBe(true))
}

afterEach(() => {
  for (const socket of sockets.splice(0)) socket.disconnect()
  for (const ws of wrappers.splice(0)) ws.close()
  expect(nativeWebSocket).not.toHaveBeenCalled()
  vi.useRealTimers()
})
afterAll(() => vi.unstubAllGlobals())

describe('SDK room Socket.IO integration', () => {
  it('uses only the reviewed endpoint, buffers pre-ready open, and keeps the business id', async () => {
    const f = fixture()
    const socket = room(f.options)
    expect(f.connect).not.toHaveBeenCalled()
    expect(socket.io.opts).toMatchObject({
      autoConnect: false,
      withCredentials: false,
      upgrade: false,
      timestampRequests: false,
      path: '/socket.io/',
      forceNew: true,
      retries: 0,
    })
    await connected(socket, f.connection)
    expect(f.connect).toHaveBeenCalledExactlyOnceWith('room_socket', {
      textMode: 'text',
      timeoutMs: 1000,
      signal: expect.any(AbortSignal),
    })
    expect(socket.id).toBe('room-business-id')
    expect(socket.id).not.toBe(f.connection.id)
    expect(socket.io.engine.id).toBe('engine-id')
    expect(f.connection.sent).toEqual(['40'])
  })

  it('forwards shared 42 events in both directions and Engine.IO ping/pong as raw text', async () => {
    const f = fixture()
    const socket = room(f.options)
    const created = vi.fn()
    socket.on('room:created', created)
    await connected(socket, f.connection)
    socket.emit('room:join', { roomId: 'same-room', nickname: 'Mapp' })
    await vi.waitFor(() =>
      expect(f.connection.sent).toContain('42["room:join",{"roomId":"same-room","nickname":"Mapp"}]'),
    )
    f.connection.fire('message', '42["room:created",{"roomId":"same-room","userId":"user-1"}]')
    await vi.waitFor(() => expect(created).toHaveBeenCalledExactlyOnceWith({ roomId: 'same-room', userId: 'user-1' }))
    f.connection.fire('message', '2')
    await vi.waitFor(() => expect(f.connection.sent).toContain('3'))
    expect(f.connection.sent).not.toContain('"3"')
  })

  it('decodes binary Socket.IO attachments and sends binary Engine.IO frames', async () => {
    const f = fixture()
    const socket = room(f.options)
    const received = vi.fn()
    socket.on('room:created', received)
    await connected(socket, f.connection)
    f.connection.fire('message', '451-["room:created",{"roomId":"same-room","userId":{"_placeholder":true,"num":0}}]')
    f.connection.fire('message', new Uint8Array([7, 8, 9]))
    await vi.waitFor(() => expect(received).toHaveBeenCalledTimes(1))
    // Engine.IO defaults to Buffer in Node and ArrayBuffer in the browser.
    expect(received.mock.calls[0][0].roomId).toBe('same-room')
    expect(new Uint8Array(received.mock.calls[0][0].userId)).toEqual(new Uint8Array([7, 8, 9]))
    socket.io.engine.write(new Uint8Array([10, 11]))
    await vi.waitFor(() => expect(f.connection.send).toHaveBeenCalled())
    expect(f.connection.send.mock.calls[0][0]).toEqual(new Uint8Array([10, 11]))
  })

  it('rejects offline emit/send/emitWithAck without filling the Socket.IO sendBuffer', async () => {
    const f = fixture()
    const socket = room(f.options)
    expect(() => socket.emit('queue:clear')).toThrow('SDK room socket is disconnected')
    expect(() => socket.send('offline')).toThrow('SDK room socket is disconnected')
    await expect(socket.emitWithAck('queue:clear')).rejects.toThrow('SDK room socket is disconnected')
    expect(socket.sendBuffer).toEqual([])
    await connected(socket, f.connection)
    expect(f.connection.sent).toEqual(['40'])
  })

  it('retains library reconnection without replaying sent or offline room commands', async () => {
    const first = new FixtureConnection()
    const second = new FixtureConnection()
    const f = fixture(first)
    f.connect.mockResolvedValueOnce(first).mockResolvedValueOnce(second)
    const socket = room(f.options, true)
    socket.io.reconnectionDelay(1).reconnectionDelayMax(1).randomizationFactor(0)
    await connected(socket, first)
    socket.emit('queue:clear')
    await vi.waitFor(() => expect(first.sent).toContain('42["queue:clear"]'))
    first.fire('close', { code: 1006, reason: SECRET })
    expect(() => socket.emit('player:pause')).toThrow('SDK room socket is disconnected')
    expect(socket.sendBuffer).toEqual([])
    await subscribed(second)
    second.handshake()
    await vi.waitFor(() => expect(socket.connected).toBe(true))
    expect(second.sent).toEqual(['40'])
    expect(f.connect).toHaveBeenCalledTimes(2)
  })

  it('does not retry a failed SDK write and sanitizes the transport error', async () => {
    const f = fixture()
    const socket = room(f.options)
    await connected(socket, f.connection)
    const errors = vi.fn()
    socket.io.engine.on('error', errors)
    f.connection.sendText.mockRejectedValueOnce(new Error(SECRET))
    socket.emit('queue:clear')
    await vi.waitFor(() => expect(socket.connected).toBe(false))
    expect(f.connection.sendText.mock.calls.filter(([text]) => text === '42["queue:clear"]')).toHaveLength(1)
    expect(errors).toHaveBeenCalledTimes(1)
    expect(errors.mock.calls[0][0].description.message).toBe('SDK room transport failed')
    expect(JSON.stringify(errors.mock.calls)).not.toContain(SECRET)
    expect(f.connection.subscriptions.every((unsubscribe) => unsubscribe.mock.calls.length === 1)).toBe(true)
  })
})

describe('SDK WebSocket lifecycle and framing', () => {
  it('opens only after ready and preserves raw strings and binaryType with view offsets', async () => {
    const f = fixture()
    const { ws } = wrapper(f.options)
    const order: string[] = []
    ws.onopen = () => {
      order.push('open')
    }
    const message = vi.fn(() => {
      order.push('message')
    })
    ws.onmessage = message
    await subscribed(f.connection)
    const bytes = new Uint8Array([0, 1, 2, 0])
    f.connection.fire('message', '0{"sid":"not-json-converted"}')
    f.connection.fire('message', bytes.subarray(1, 3))
    expect(order).toEqual([])
    bytes[1] = 99
    f.connection.opened.resolve()
    await vi.waitFor(() => expect(order).toEqual(['open', 'message', 'message']))
    expect(message.mock.calls[0]).toEqual([{ data: '0{"sid":"not-json-converted"}' }])
    expect(message.mock.calls[1]).toEqual([{ data: new Uint8Array([1, 2]).buffer }])
    ws.binaryType = 'blob'
    f.connection.fire('message', new Uint8Array([3, 4]))
    const blob = (message.mock.calls[2] as unknown as [{ data: Blob }])[0].data
    expect(blob).toBeInstanceOf(Blob)
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array([3, 4]))
  })

  it('serializes text/binary sends, snapshots views, and uses sendText without JSON encoding', async () => {
    const f = fixture()
    const { ws } = wrapper(f.options)
    await subscribed(f.connection)
    f.connection.opened.resolve()
    await vi.waitFor(() => expect(ws.readyState).toBe(1))
    const pending = deferred<null>()
    f.connection.sendText.mockReturnValueOnce(pending.promise)
    ws.send('2')
    const data = new Uint8Array([0, 5, 6, 0])
    ws.send(data.subarray(1, 3))
    data[1] = 77
    ws.send('42["queue:clear"]')
    await vi.waitFor(() => expect(f.connection.sendText).toHaveBeenCalledTimes(1))
    expect(f.connection.send).not.toHaveBeenCalled()
    pending.resolve(null)
    await vi.waitFor(() => expect(f.connection.sendText).toHaveBeenCalledTimes(2))
    expect(f.connection.send.mock.calls[0][0]).toEqual(new Uint8Array([5, 6]))
    expect(f.connection.sendText.mock.calls.map(([text]) => text)).toEqual(['2', '42["queue:clear"]'])
    expect(f.connection.send.mock.invocationCallOrder[0]).toBeGreaterThan(
      f.connection.sendText.mock.invocationCallOrder[0],
    )
    expect(f.connection.sendText.mock.invocationCallOrder[1]).toBeGreaterThan(
      f.connection.send.mock.invocationCallOrder[0],
    )
  })

  it('passes large room frames through unchanged', async () => {
    const f = fixture()
    const { ws } = wrapper(f.options)
    const message = vi.fn()
    ws.onmessage = message
    await subscribed(f.connection)
    f.connection.opened.resolve()
    await vi.waitFor(() => expect(ws.readyState).toBe(1))
    const large = 'x'.repeat(70000)
    ws.send(large)
    await vi.waitFor(() => expect(f.connection.sendText).toHaveBeenCalledWith(large, expect.anything()))
    f.connection.fire('message', large)
    expect(message).toHaveBeenCalledWith({ data: large })
  })

  it('aborts pending connect, closes a late connection and handles late ready/close rejections', async () => {
    const f = fixture()
    const pending = deferred<SdkConnection>()
    f.connect.mockReturnValueOnce(pending.promise)
    const { ws } = wrapper(f.options)
    const closed = vi.fn()
    const errors = vi.fn()
    ws.onclose = closed
    ws.onerror = errors
    await vi.waitFor(() => expect(f.connect).toHaveBeenCalledTimes(1))
    const signal = f.connect.mock.calls[0][1].signal
    ws.close()
    ws.close()
    expect(signal.aborted).toBe(true)
    f.connection.close.mockRejectedValueOnce(new Error(SECRET))
    pending.resolve(f.connection)
    await vi.waitFor(() => expect(f.connection.close).toHaveBeenCalledTimes(1))
    f.connection.opened.reject(new Error(SECRET))
    await Promise.resolve()
    expect(closed).toHaveBeenCalledTimes(1)
    expect(errors).not.toHaveBeenCalled()
    expect(f.connection.subscriptions).toEqual([])
  })

  it('cancels subscriptions while waiting for ready and ignores late frames/open', async () => {
    const f = fixture()
    const { ws } = wrapper(f.options)
    const open = vi.fn()
    const message = vi.fn()
    ws.onopen = open
    ws.onmessage = message
    await subscribed(f.connection)
    ws.close()
    f.connection.fire('message', OPEN)
    f.connection.opened.resolve()
    await Promise.resolve()
    expect(open).not.toHaveBeenCalled()
    expect(message).not.toHaveBeenCalled()
    expect(f.connection.subscriptions.every((unsubscribe) => unsubscribe.mock.calls.length === 1)).toBe(true)
    expect(f.connection.close).toHaveBeenCalledTimes(1)
  })

  it.each(['throw', 'reject', 'ready', 'event'] as const)(
    'sanitizes SDK %s errors and closes once',
    async (failure) => {
      const f = fixture()
      if (failure === 'throw')
        f.connect.mockImplementationOnce(() => {
          throw new Error(SECRET)
        })
      if (failure === 'reject') f.connect.mockRejectedValueOnce(new Error(SECRET))
      const { ws } = wrapper(f.options)
      const errors = vi.fn()
      const closed = vi.fn()
      ws.onerror = errors
      ws.onclose = closed
      if (failure === 'ready' || failure === 'event') {
        await subscribed(f.connection)
        if (failure === 'ready') f.connection.opened.reject(new Error(SECRET))
        else f.connection.fire('error', { code: SECRET })
      }
      await vi.waitFor(() => expect(ws.readyState).toBe(3))
      expect(errors).toHaveBeenCalledExactlyOnceWith(new Error('SDK room transport failed'))
      expect(closed).toHaveBeenCalledExactlyOnceWith({
        code: 1006,
        reason: 'SDK room transport failed',
        wasClean: false,
      })
      expect(JSON.stringify([errors.mock.calls, closed.mock.calls])).not.toContain(SECRET)
      if (failure === 'ready' || failure === 'event') expect(f.connection.close).toHaveBeenCalledTimes(1)
    },
  )

  it('has a bounded connection/ready timeout and closes a later result', async () => {
    vi.useFakeTimers()
    const f = fixture()
    const pending = deferred<SdkConnection>()
    f.connect.mockReturnValueOnce(pending.promise)
    const { ws } = wrapper({ ...f.options, timeoutMs: 25 })
    const errors = vi.fn()
    ws.onerror = errors
    await vi.advanceTimersByTimeAsync(26)
    expect(ws.readyState).toBe(3)
    expect(f.connect.mock.calls[0][1].signal.aborted).toBe(true)
    pending.resolve(f.connection)
    await vi.advanceTimersByTimeAsync(0)
    expect(f.connection.close).toHaveBeenCalledTimes(1)
    expect(errors).toHaveBeenCalledTimes(1)
  })

  it('rejects auto-parsed JSON frames', async () => {
    const f = fixture()
    const { ws } = wrapper(f.options)
    const errors = vi.fn()
    ws.onerror = errors
    await subscribed(f.connection)
    f.connection.fire('message', { sid: 'auto-parsed' })
    expect(ws.readyState).toBe(3)
    expect(errors).toHaveBeenCalledTimes(1)
  })
})

describe('reviewed transport target validation', () => {
  it.each([
    'https://reviewed.example/socket.io/?EIO=4&transport=websocket',
    'ws://reviewed.example/socket.io/?EIO=4&transport=websocket',
    `${TARGET}&mini_app_token=fixture-token`,
    'wss://reviewed.example/socket.io/?EIO=3&transport=websocket',
    'wss://reviewed.example/socket.io/?EIO=4&transport=polling',
    `${TARGET}&sid=old`,
    `${TARGET}&b64=1`,
    `${TARGET}&t=123`,
    `${TARGET}#fragment`,
    'wss://user:password@reviewed.example/socket.io/?EIO=4&transport=websocket',
  ])('rejects unsupported reviewed URL %# without calling SDK', (reviewedEndpointUrl) => {
    const f = fixture()
    expect(() => createSdkRoomSocket({ ...f.options, reviewedEndpointUrl })).toThrow(
      'Unsupported SDK room transport target',
    )
    expect(f.connect).not.toHaveBeenCalled()
  })

  it('rejects protocol and request query mismatches', () => {
    const f = fixture()
    const { transport } = wrapper(f.options)
    expect(() => transport.createSocket(TARGET, 'protocol')).toThrow('Unsupported SDK room transport target')
    expect(() => transport.createSocket(`${TARGET}&extra=ignored`, undefined)).toThrow(
      'Unsupported SDK room transport target',
    )
    expect(() => transport.createSocket(TARGET.replace('reviewed.example', 'other.example'), undefined)).toThrow(
      'Unsupported SDK room transport target',
    )
    expect(() => transport.createSocket(TARGET.replace('/socket.io/', '/other/'), undefined)).toThrow(
      'Unsupported SDK room transport target',
    )
  })

  it('preserves approved fixed query and path through the actual Engine.IO URI', async () => {
    const f = fixture()
    const socket = room({
      ...f.options,
      reviewedEndpointUrl: 'wss://reviewed.example/custom/socket.io/?tenant=music&EIO=4&transport=websocket',
    })
    await connected(socket, f.connection)
    expect(f.connect).toHaveBeenCalledTimes(1)
    expect(f.connect.mock.calls[0][0]).toBe('room_socket')
    expect(socket.io.opts.query).toEqual({ tenant: 'music' })
    expect(socket.io.opts.path).toBe('/custom/socket.io/')
  })
})
