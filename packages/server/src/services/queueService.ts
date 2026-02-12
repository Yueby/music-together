import type { Track } from '@music-together/shared'
import { LIMITS } from '@music-together/shared'
import { roomRepo } from '../repositories/roomRepository.js'

export function addTrack(roomId: string, track: Track): boolean {
  const room = roomRepo.get(roomId)
  if (!room) return false
  if (room.queue.length >= LIMITS.QUEUE_MAX_SIZE) return false
  room.queue.push(track)
  return true
}

export function removeTrack(roomId: string, trackId: string): void {
  const room = roomRepo.get(roomId)
  if (room) {
    room.queue = room.queue.filter((t) => t.id !== trackId)
  }
}

export function reorderTracks(roomId: string, trackIds: string[]): void {
  const room = roomRepo.get(roomId)
  if (!room) return
  if (!Array.isArray(trackIds) || trackIds.length === 0) return

  const trackMap = new Map(room.queue.map((t) => [t.id, t]))
  const seen = new Set<string>()
  const reordered: Track[] = []
  for (const id of trackIds) {
    if (seen.has(id)) continue
    seen.add(id)
    const track = trackMap.get(id)
    if (track) reordered.push(track)
  }
  room.queue = reordered
}

export function getNextTrack(roomId: string): Track | null {
  const room = roomRepo.get(roomId)
  if (!room || room.queue.length === 0) return null

  const currentIndex = room.currentTrack
    ? room.queue.findIndex((t) => t.id === room.currentTrack!.id)
    : -1

  const nextIndex = currentIndex + 1
  return nextIndex < room.queue.length ? room.queue[nextIndex] : null
}
