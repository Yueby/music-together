import type { Server, Socket } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from '@music-together/shared'
import type { RoomData } from '../repositories/types.js'
import type { User } from '@music-together/shared'

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>

export interface HandlerContext {
  io: TypedServer
  socket: TypedSocket
  roomId: string
  room: RoomData
  user: User
}
