import { nanoid } from 'nanoid'
import { config } from '../config.js'

interface RejoinTicket {
  token: string
  roomId: string
  userId: string
  expiresAt: number
}

const tickets = new Map<string, RejoinTicket>()
const roomUserIndex = new Map<string, Set<string>>()

function roomUserKey(roomId: string, userId: string): string {
  return `${roomId}:${userId}`
}

function pruneExpired(): void {
  const now = Date.now()
  for (const [token, ticket] of tickets) {
    if (ticket.expiresAt <= now) {
      tickets.delete(token)
      const key = roomUserKey(ticket.roomId, ticket.userId)
      const set = roomUserIndex.get(key)
      if (set) {
        set.delete(token)
        if (set.size === 0) roomUserIndex.delete(key)
      }
    }
  }
}

export function issueRejoinTicket(
  roomId: string,
  userId: string,
): { token: string; expiresAt: number; ttlMs: number } {
  pruneExpired()
  const token = nanoid(36)
  const expiresAt = Date.now() + config.rejoin.ttlMs
  const ticket: RejoinTicket = { token, roomId, userId, expiresAt }
  tickets.set(token, ticket)

  const key = roomUserKey(roomId, userId)
  const set = roomUserIndex.get(key) ?? new Set<string>()
  set.add(token)
  roomUserIndex.set(key, set)

  return { token, expiresAt, ttlMs: config.rejoin.ttlMs }
}

export function consumeRejoinTicket(token: string, roomId: string, userId: string): boolean {
  pruneExpired()
  const ticket = tickets.get(token)
  if (!ticket) return false
  if (ticket.roomId !== roomId || ticket.userId !== userId) return false

  tickets.delete(token)
  const key = roomUserKey(roomId, userId)
  const set = roomUserIndex.get(key)
  if (set) {
    set.delete(token)
    if (set.size === 0) roomUserIndex.delete(key)
  }
  return true
}

export function revokeRejoinTickets(roomId: string, userId: string): void {
  const key = roomUserKey(roomId, userId)
  const set = roomUserIndex.get(key)
  if (!set) return
  for (const token of set) tickets.delete(token)
  roomUserIndex.delete(key)
}

export function cleanupRoomRejoinTickets(roomId: string): void {
  for (const [key, set] of roomUserIndex) {
    if (!key.startsWith(`${roomId}:`)) continue
    for (const token of set) tickets.delete(token)
    roomUserIndex.delete(key)
  }
}
