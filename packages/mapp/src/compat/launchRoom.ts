import { ROOM_ID_PATTERN } from '@music-together/shared'

function validateRoomId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const roomId = value.trim()
  return ROOM_ID_PATTERN.test(roomId) ? roomId : undefined
}

function queryRoomId(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return value.every((entry) => typeof entry === 'string') ? validateRoomId(value[0]) : undefined
  }
  return validateRoomId(value)
}

export function extractLaunchRoomId(params: unknown): string | undefined {
  if (!params || typeof params !== 'object') return undefined
  if ('query' in params && params.query && typeof params.query === 'object') {
    const query = params.query as Record<string, unknown>
    const roomId = queryRoomId(query.room) ?? queryRoomId(query.roomId)
    if (roomId) return roomId
  }
  if (!('hash' in params) || typeof params.hash !== 'string') return undefined

  const hash = params.hash.replace(/^#/, '')
  const roomPath = /^\/?room\/([^/?#]+)$/.exec(hash)
  if (roomPath) return validateRoomId(roomPath[1])
  const query = new URLSearchParams(hash)
  return validateRoomId(query.get('room')) ?? validateRoomId(query.get('roomId'))
}
