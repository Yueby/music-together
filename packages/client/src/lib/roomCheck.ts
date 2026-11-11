import { SERVER_URL } from './config'
import type { RoomCheckReader } from './RoomCheckReader'

/** Native Web preflight; the socket is deliberately not involved. */
export const roomCheck: RoomCheckReader = async (_socket, roomId, options) => {
  const response = await fetch(
    `${SERVER_URL}/api/rooms/${encodeURIComponent(roomId)}/check`,
    { credentials: 'include', signal: options?.signal },
  )
  if (!response.ok) {
    // 404 (unknown room) and 400 (malformed room id, which cannot exist) are
    // definitive answers from the room check route. Everything else (502/503
    // from a proxy, 429 rate limits, 5xx, ...) says nothing about the room, so
    // surface it as a transient error and let the caller keep the join path open.
    if (response.status === 404 || response.status === 400) return null
    throw new Error(`Room check failed with HTTP ${response.status}`)
  }
  const { name, hasPassword, userCount } = await response.json()
  return { name, hasPassword, userCount }
}
