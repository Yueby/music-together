import { SERVER_URL } from './config'
import type { RoomCheckReader } from './RoomCheckReader'

/** Native Web preflight; the socket is deliberately not involved. */
export const roomCheck: RoomCheckReader = async (_socket, roomId, options) => {
  const response = await fetch(
    `${SERVER_URL}/api/rooms/${encodeURIComponent(roomId)}/check`,
    { credentials: 'include', signal: options?.signal },
  )
  if (!response.ok) return null
  const { name, hasPassword, userCount } = await response.json()
  return { name, hasPassword, userCount }
}
