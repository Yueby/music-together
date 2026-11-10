import { EVENTS } from '@music-together/shared'
import type { ClientToServerEvents } from '@music-together/shared'
import type { TypedSocket } from './socket'

export interface RoomCommands {
  create(socket: TypedSocket, input: Parameters<ClientToServerEvents[typeof EVENTS.ROOM_CREATE]>[0]): boolean
  join(
    socket: TypedSocket,
    input: Parameters<ClientToServerEvents[typeof EVENTS.ROOM_JOIN]>[0],
    options?: { automatic?: boolean },
  ): boolean
  leave(socket: TypedSocket): void
}

export const roomCommands: RoomCommands = {
  create(socket, input) {
    socket.emit(EVENTS.ROOM_CREATE, input)
    return true
  },
  join(socket, input) {
    socket.emit(EVENTS.ROOM_JOIN, input)
    return true
  },
  leave(socket) {
    socket.emit(EVENTS.ROOM_LEAVE)
  },
}
