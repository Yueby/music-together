import '../cspValidation.ts'
import { EVENTS, type ClientToServerEvents, type ServerToClientEvents } from '@music-together/shared'
import type { SdkRoomSocket } from '../../../client/src/lib/platform/SdkRoomSocket.ts'
import { createMappRoomSocket, type MappRoomSocketOptions } from './roomSocket.ts'

export type MappRoomSessionStatus =
  | 'idle'
  | 'connecting'
  | 'awaiting_identity'
  | 'ready'
  | 'creating'
  | 'joining'
  | 'joined'
  | 'disconnected'
  | 'disposed'
export type MappRoomSessionErrorCode =
  | 'NOT_READY'
  | 'REQUEST_PENDING'
  | 'CONNECT_FAILED'
  | 'CREATE_FAILED'
  | 'JOIN_FAILED'
  | 'REJOIN_FAILED'
  | 'REJOIN_TOKEN_MISSING'
  | 'REJOIN_TOKEN_EXPIRED'
  | 'IDENTITY_CHANGED'
  | null

export interface MappRoomSessionSnapshot {
  readonly status: MappRoomSessionStatus
  readonly connected: boolean
  readonly userId: string | null
  readonly roomId: string | null
  readonly errorCode: MappRoomSessionErrorCode
}

export interface MappRoomSessionOptions extends MappRoomSocketOptions {
  onChange?: (snapshot: MappRoomSessionSnapshot) => void
}

type CreateInput = Parameters<ClientToServerEvents[typeof EVENTS.ROOM_CREATE]>[0]
// Rejoin credentials are exclusively supplied by this session, never by a caller.
type JoinInput = Omit<Parameters<ClientToServerEvents[typeof EVENTS.ROOM_JOIN]>[0], 'rejoinToken'>
type Ticket = Parameters<ServerToClientEvents[typeof EVENTS.ROOM_REJOIN_TOKEN]>[0]
type Pending = {
  kind: 'create' | 'join' | 'rejoin'
  nickname: string
  roomId?: string
  ticket?: Ticket
}
type Confirmed = { roomId: string; nickname: string }

export interface MappRoomSession {
  readonly socket: SdkRoomSocket
  readonly snapshot: MappRoomSessionSnapshot
  /** Observe stable snapshots without taking ownership of the socket lifetime. */
  subscribe(listener: () => void): () => void
  connect(): void
  /** Returns whether the request was sent, not whether the server accepted it. */
  createRoom(input: CreateInput): boolean
  joinRoom(input: JoinInput): boolean
  leaveRoom(): void
  dispose(): void
}

const IDLE: MappRoomSessionSnapshot = Object.freeze({
  status: 'idle',
  connected: false,
  userId: null,
  roomId: null,
  errorCode: null,
})

/** `socket.emit` throws while the transport is down; report that as "not sent". */
function attempt(send: () => void): boolean {
  try {
    send()
    return true
  } catch {
    return false
  }
}

/** Connection/identity/re-entry only; room and playback events remain on the original socket. */
export function createMappRoomSession(options: MappRoomSessionOptions): MappRoomSession {
  const { onChange, ...socketOptions } = options
  const socket = createMappRoomSocket(socketOptions)
  let snapshot = IDLE
  let disposed = false
  let identityReady = false
  let lastUserId: string | null = null
  let pending: Pending | undefined
  let confirmed: Confirmed | undefined
  // Credentials live only in this closure, and are never copied into snapshots.
  let recovery: (Confirmed & { ticket: Ticket }) | undefined
  let needsRestore = false
  let attemptedRestoreSocketId: string | undefined
  const listeners = new Set<() => void>()

  function publish(patch: Partial<MappRoomSessionSnapshot>): void {
    if (disposed) return
    snapshot = Object.freeze({ ...snapshot, ...patch })
    onChange?.(snapshot)
    for (const listener of listeners) listener()
  }

  const ready = () => !disposed && socket.connected && identityReady

  function restingStatus(): MappRoomSessionStatus {
    if (!socket.connected) return 'disconnected'
    if (!identityReady) return 'awaiting_identity'
    return snapshot.roomId ? 'joined' : 'ready'
  }

  function clearRoom(): void {
    pending = undefined
    confirmed = undefined
    recovery = undefined
    needsRestore = false
  }

  function failRequest(): void {
    const kind = pending?.kind
    pending = undefined
    if (kind === 'rejoin') {
      clearRoom()
      publish({ roomId: null, status: restingStatus(), errorCode: 'REJOIN_FAILED' })
    } else if (kind) {
      // Join validation can fail before the server leaves the previous room.
      publish({ status: restingStatus(), errorCode: kind === 'create' ? 'CREATE_FAILED' : 'JOIN_FAILED' })
    }
  }

  /** Re-enter the confirmed room once per new socket id; creates/unconfirmed joins are never replayed. */
  function reconcile(): void {
    if (!ready()) {
      publish({ connected: socket.connected, status: restingStatus() })
      return
    }
    if (!needsRestore || pending || !socket.id || attemptedRestoreSocketId === socket.id) {
      publish({
        connected: true,
        status: pending ? (pending.kind === 'create' ? 'creating' : 'joining') : restingStatus(),
      })
      return
    }
    attemptedRestoreSocketId = socket.id
    needsRestore = false
    if (!recovery || recovery.ticket.expiresAt <= Date.now()) {
      const errorCode = recovery ? 'REJOIN_TOKEN_EXPIRED' : 'REJOIN_TOKEN_MISSING'
      clearRoom()
      publish({ connected: true, roomId: null, status: 'ready', errorCode })
      return
    }
    const { roomId, nickname, ticket } = recovery
    pending = { kind: 'rejoin', roomId, nickname }
    publish({ connected: true, status: 'joining', errorCode: null })
    if (!attempt(() => socket.emit(EVENTS.ROOM_JOIN, { roomId, nickname, rejoinToken: ticket.token }))) failRequest()
  }

  const onIdentity: ServerToClientEvents[typeof EVENTS.IDENTITY_READY] = ({ userId }) => {
    if (lastUserId !== null && lastUserId !== userId) {
      clearRoom()
      publish({ roomId: null, errorCode: 'IDENTITY_CHANGED' })
    }
    lastUserId = userId
    identityReady = true
    publish({ userId })
    reconcile()
  }
  const onDisconnect = (): void => {
    needsRestore = needsRestore || snapshot.roomId !== null || recovery !== undefined
    pending = undefined // Never replay a create, password, or unconfirmed join.
    confirmed = undefined
    identityReady = false
    publish({ connected: false, userId: null, roomId: null, status: 'disconnected', errorCode: null })
  }
  const onConnectError = (): void => {
    identityReady = false
    publish({ connected: false, userId: null, status: 'disconnected', errorCode: 'CONNECT_FAILED' })
  }
  const onCreated: ServerToClientEvents[typeof EVENTS.ROOM_CREATED] = ({ roomId }) => {
    if (ready() && pending?.kind === 'create') pending.roomId = roomId
  }
  const onState: ServerToClientEvents[typeof EVENTS.ROOM_STATE] = (room) => {
    if (!ready() || !pending?.roomId || room.id !== pending.roomId) return
    confirmed = { roomId: room.id, nickname: pending.nickname }
    recovery =
      pending.ticket && pending.ticket.expiresAt > Date.now() ? { ...confirmed, ticket: pending.ticket } : undefined
    pending = undefined
    needsRestore = false
    publish({ roomId: room.id, status: 'joined', errorCode: null })
  }
  const onTicket: ServerToClientEvents[typeof EVENTS.ROOM_REJOIN_TOKEN] = (data) => {
    if (!ready() || data.expiresAt <= Date.now()) return
    // Copy only the protocol fields; never retain a room-state/password object.
    const ticket: Ticket = { roomId: data.roomId, token: data.token, expiresAt: data.expiresAt }
    if (pending?.roomId === data.roomId) pending.ticket = ticket
    if (confirmed?.roomId === data.roomId) recovery = { ...confirmed, ticket }
  }
  const onRoomError = (): void => {
    if (pending) failRequest()
  }

  socket.on('connect', reconcile)
  socket.on('disconnect', onDisconnect)
  socket.on('connect_error', onConnectError)
  socket.on(EVENTS.IDENTITY_READY, onIdentity)
  socket.on(EVENTS.ROOM_CREATED, onCreated)
  socket.on(EVENTS.ROOM_STATE, onState)
  socket.on(EVENTS.ROOM_REJOIN_TOKEN, onTicket)
  socket.on(EVENTS.ROOM_ERROR, onRoomError)

  /** Starts a manual request, which supersedes any automatic re-entry. */
  function beginRequest(next: Pending, status: 'creating' | 'joining'): boolean {
    if (disposed) return false
    if (!ready()) {
      publish({ errorCode: 'NOT_READY' })
      return false
    }
    if (pending) {
      publish({ errorCode: 'REQUEST_PENDING' })
      return false
    }
    needsRestore = false
    pending = next
    publish({ status, errorCode: null })
    return true
  }

  function finishRequest(sent: boolean): boolean {
    if (!sent) failRequest()
    return sent
  }

  return {
    socket,
    get snapshot() {
      return snapshot
    },
    subscribe(listener) {
      if (disposed) return () => {}
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    connect() {
      if (disposed || socket.connected) return
      publish({ status: 'connecting', errorCode: null })
      socket.connect()
    },
    createRoom(input) {
      if (!beginRequest({ kind: 'create', nickname: input.nickname }, 'creating')) return false
      // Deliberately whitelist fields instead of forwarding client identity claims.
      const { nickname, roomName, password } = input
      return finishRequest(attempt(() => socket.emit(EVENTS.ROOM_CREATE, { nickname, roomName, password })))
    },
    joinRoom(input) {
      const { roomId, nickname, password } = input
      if (!beginRequest({ kind: 'join', roomId, nickname }, 'joining')) return false
      return finishRequest(attempt(() => socket.emit(EVENTS.ROOM_JOIN, { roomId, nickname, password })))
    },
    leaveRoom() {
      if (disposed) return
      clearRoom()
      publish({
        roomId: null,
        status: socket.connected ? (identityReady ? 'ready' : 'awaiting_identity') : 'disconnected',
        errorCode: null,
      })
      if (socket.connected) attempt(() => socket.emit(EVENTS.ROOM_LEAVE))
    },
    dispose() {
      if (disposed) return
      clearRoom()
      identityReady = false
      disposed = true
      socket.off('connect', reconcile)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
      socket.off(EVENTS.IDENTITY_READY, onIdentity)
      socket.off(EVENTS.ROOM_CREATED, onCreated)
      socket.off(EVENTS.ROOM_STATE, onState)
      socket.off(EVENTS.ROOM_REJOIN_TOKEN, onTicket)
      socket.off(EVENTS.ROOM_ERROR, onRoomError)
      snapshot = Object.freeze({ ...IDLE, status: 'disposed' })
      socket.disconnect()
      onChange?.(snapshot)
      for (const listener of listeners) listener()
      listeners.clear()
    },
  }
}
