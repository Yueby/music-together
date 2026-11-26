import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@music-together/shared'
import { SERVER_URL } from './config'

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

let socket: TypedSocket | null = null

export function getSocket(): TypedSocket {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: false,
      withCredentials: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    }) as TypedSocket
  }
  return socket
}
