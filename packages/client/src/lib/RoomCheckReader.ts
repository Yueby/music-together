import type { TypedSocket } from './socket'

export type RoomCheckInfo = {
  name: string
  hasPassword: boolean
  userCount: number
}

export type RoomCheckReader = (
  socket: TypedSocket,
  roomId: string,
  options?: { signal?: AbortSignal },
) => Promise<RoomCheckInfo | null>
