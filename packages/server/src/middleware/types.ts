import type { Server, Socket } from 'socket.io'
import type { ClientKind, ClientToServerEvents, ServerToClientEvents } from '@music-together/shared'
import type { RoomData } from '../repositories/types.js'
import type { User } from '@music-together/shared'

export interface SocketData {
  identityUserId: string
  clientKind?: ClientKind
  clientIp?: string
}

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>

export interface HandlerContext {
  io: TypedServer
  socket: TypedSocket
  roomId: string
  room: RoomData
  user: User
}
