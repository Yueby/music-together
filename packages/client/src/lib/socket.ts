import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@music-together/shared'
import { SERVER_URL } from './config'

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

let socket: TypedSocket | null = null

export function getSocket(): TypedSocket {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: false,
      transports: ['websocket'],
    }) as TypedSocket
  }
  return socket
}

export function connectSocket(): TypedSocket {
  const s = getSocket()
  if (!s.connected) {
    s.connect()
  }
  return s
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

/** Returns a promise that resolves when the socket is connected */
export function waitForConnect(): Promise<TypedSocket> {
  const s = getSocket()
  if (s.connected) return Promise.resolve(s)
  return new Promise((resolve) => {
    s.once('connect', () => resolve(s))
    if (!s.connected) s.connect()
  })
}
