import { io, WebSocket as EngineWebSocket, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@music-together/shared'

export type SdkRoomSocket = Socket<ServerToClientEvents, ClientToServerEvents>

// Structural SDK 0.3 boundary: the Web client does not depend on the Mapp SDK.
export interface SdkSocketEvents {
  message: unknown
  error: { code: string }
  close: { code: number; reason: string }
}

type Binary = Blob | ArrayBuffer | ArrayBufferView

export interface SdkConnection {
  readonly ready: Promise<void>
  sendText(text: string, options?: { signal?: AbortSignal; timeoutMs?: number }): Promise<null>
  send(data: Binary, options?: { signal?: AbortSignal; timeoutMs?: number }): Promise<null>
  close(code?: number, reason?: string): Promise<null>
  on<K extends keyof SdkSocketEvents>(event: K, listener: (value: SdkSocketEvents[K]) => void): () => void
}

export interface SdkWebSocketClient {
  connect(
    endpoint: string,
    options: {
      textMode: 'text'
      signal: AbortSignal
      timeoutMs: number
    },
  ): Promise<SdkConnection>
}

export interface SdkRoomSocketOptions {
  webSocket: SdkWebSocketClient
  /** A declared manifest endpoint name, never a URL. */
  endpoint: string
  /** The reviewed URL, including EIO=4&transport=websocket and any fixed query. */
  reviewedEndpointUrl: string
  timeoutMs?: number
}

const FAILURE = 'SDK room transport failed'
const INVALID_TARGET = 'Unsupported SDK room transport target'
const RESERVED_QUERY_KEYS = ['sid', 'b64', 't', 'mini_app_token']

type Frame = string | Uint8Array | Blob

/** Snapshot a view so later caller mutation cannot change an already queued frame. */
function copyBinary(data: ArrayBuffer | ArrayBufferView): Uint8Array<ArrayBuffer> {
  return data instanceof ArrayBuffer
    ? new Uint8Array(data.slice(0))
    : new Uint8Array(new Uint8Array(data.buffer, data.byteOffset, data.byteLength))
}

/** Only this transport instance uses the SDK; native WebSocket is never replaced. */
class SdkWebSocket {
  binaryType = 'arraybuffer'
  readyState = 0
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string | ArrayBuffer | Blob }) => void) | null = null
  onerror: ((error: Error) => void) | null = null
  onclose: ((event: { code: number; reason: string; wasClean: boolean }) => void) | null = null

  private readonly abort = new AbortController()
  private connection?: SdkConnection
  private subscriptions: (() => void)[] = []
  /** Frames delivered by the SDK before `ready` resolves. */
  private incoming: (string | Uint8Array)[] = []
  /** The SDK sends asynchronously; chaining keeps frames in order. */
  private sendQueue: Promise<void> = Promise.resolve()
  private readonly timer: ReturnType<typeof setTimeout>

  constructor(
    private readonly options: SdkRoomSocketOptions,
    private readonly timeoutMs: number,
  ) {
    this.timer = setTimeout(() => this.fail(), timeoutMs)
    // Defer even a synchronously throwing SDK until BaseWS has installed handlers.
    void Promise.resolve()
      .then(() => this.connect())
      .catch(() => this.fail())
  }

  private async connect(): Promise<void> {
    if (this.readyState !== 0) return
    const connection = await this.options.webSocket.connect(this.options.endpoint, {
      textMode: 'text',
      signal: this.abort.signal,
      timeoutMs: this.timeoutMs,
    })
    // A connection delivered after cancellation may still reject its ready promise.
    void connection.ready.catch(() => {})
    if (this.readyState !== 0) {
      this.closeConnection(connection)
      return
    }
    this.connection = connection
    this.subscribe(connection, 'message', (data) => this.receive(data))
    this.subscribe(connection, 'error', () => this.fail())
    this.subscribe(connection, 'close', () => this.finish(false))
    await connection.ready
    if (this.readyState !== 0) return
    clearTimeout(this.timer)
    this.readyState = 1
    this.onopen?.()
    const frames = this.incoming
    this.incoming = []
    for (const frame of frames) {
      if (this.readyState !== 1) break
      this.deliver(frame)
    }
  }

  private subscribe<K extends keyof SdkSocketEvents>(
    connection: SdkConnection,
    event: K,
    listener: (value: SdkSocketEvents[K]) => void,
  ): void {
    this.subscriptions.push(connection.on(event, listener))
  }

  private receive(data: unknown): void {
    if (this.readyState >= 2) return
    // textMode: "text" means frames are never auto-parsed; anything else is a broken SDK.
    if (typeof data !== 'string' && !(data instanceof Uint8Array)) {
      this.fail()
      return
    }
    if (this.readyState === 0) this.incoming.push(typeof data === 'string' ? data : copyBinary(data))
    else this.deliver(data)
  }

  private deliver(data: string | Uint8Array): void {
    this.onmessage?.({
      data:
        typeof data === 'string'
          ? data
          : this.binaryType === 'blob'
            ? new Blob([copyBinary(data)])
            : copyBinary(data).buffer,
    })
  }

  send(data: string | ArrayBuffer | ArrayBufferView | Blob): void {
    if (this.readyState !== 1) return
    const frame: Frame = typeof data === 'string' || data instanceof Blob ? data : copyBinary(data)
    this.sendQueue = this.sendQueue
      .then(async () => {
        if (this.readyState !== 1) return
        const options = { signal: this.abort.signal, timeoutMs: this.timeoutMs }
        if (typeof frame === 'string') await this.connection!.sendText(frame, options)
        else await this.connection!.send(frame, options)
      })
      .catch(() => this.fail())
  }

  close(): void {
    this.finish(true)
  }

  private fail(): void {
    if (this.readyState >= 2) return
    // Never forward platform errors, URLs, close reasons, or credentials.
    try {
      this.onerror?.(new Error(FAILURE))
    } finally {
      this.finish(false)
    }
  }

  private finish(clean: boolean): void {
    if (this.readyState >= 2) return
    this.readyState = 3
    clearTimeout(this.timer)
    this.abort.abort()
    for (const unsubscribe of this.subscriptions.splice(0)) unsubscribe()
    this.incoming = []
    if (this.connection) this.closeConnection(this.connection)
    this.onclose?.({ code: clean ? 1000 : 1006, reason: clean ? '' : FAILURE, wasClean: clean })
  }

  private closeConnection(connection: SdkConnection): void {
    // A broken SDK must not escape into Engine.IO or leak its error.
    void Promise.resolve()
      .then(() => connection.close(1000))
      .catch(() => {})
  }
}

function reviewedTarget(options: SdkRoomSocketOptions): URL {
  let url: URL
  try {
    url = new URL(options.reviewedEndpointUrl)
  } catch {
    throw new Error(INVALID_TARGET)
  }
  if (
    url.protocol !== 'wss:' ||
    url.username ||
    url.password ||
    url.hash ||
    url.searchParams.get('EIO') !== '4' ||
    url.searchParams.get('transport') !== 'websocket' ||
    RESERVED_QUERY_KEYS.some((key) => url.searchParams.has(key))
  ) {
    throw new Error(INVALID_TARGET)
  }
  return url
}

/** Engine.IO must connect to exactly the reviewed URL (no sid/timestamp/extra query). */
function matchesTarget(uri: string, target: URL): boolean {
  try {
    const actual = new URL(uri)
    const expected = new URL(target.href)
    actual.searchParams.sort()
    expected.searchParams.sort()
    return actual.href === expected.href
  } catch {
    return false
  }
}

/** Public transport factory also allows isolated, port-free adapter tests. */
export function createSdkRoomTransport(options: SdkRoomSocketOptions) {
  const target = reviewedTarget(options)
  const snapshot = { ...options }
  return class SdkRoomTransport extends EngineWebSocket {
    override createSocket(uri: string, protocols: string | string[] | undefined): SdkWebSocket {
      if (protocols !== undefined || !matchesTarget(uri, target)) throw new Error(INVALID_TARGET)
      return new SdkWebSocket(snapshot, snapshot.timeoutMs ?? 10_000)
    }
  }
}

/** Independent default-namespace room socket, sharing the existing event contract. */
export function createSdkRoomSocket(options: SdkRoomSocketOptions): SdkRoomSocket {
  const target = reviewedTarget(options)
  const query = Object.fromEntries(target.searchParams)
  delete query.EIO
  delete query.transport
  const socket: SdkRoomSocket = io(target.origin, {
    path: target.pathname,
    query,
    transports: [createSdkRoomTransport(options)],
    autoConnect: false,
    withCredentials: false,
    upgrade: false,
    timestampRequests: false,
    forceNew: true,
    retries: 0,
    timeout: options.timeoutMs ?? 10_000,
  })
  // Instance-only guard: send/emitWithAck also delegate to emit. Do not queue
  // disconnected controls, and never enable Socket.IO's acknowledgement retries.
  socket.emit = new Proxy(socket.emit, {
    apply(emit, receiver, args) {
      const engine = socket.io.engine
      if (!socket.connected || engine?.readyState !== 'open' || engine._hasPingExpired()) {
        // Socket.IO consumes these modifiers per emit, including rejected emits.
        Reflect.set(socket, 'flags', {})
        throw new Error('SDK room socket is disconnected')
      }
      return Reflect.apply(emit, receiver, args)
    },
  })
  return socket
}
