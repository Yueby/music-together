import type { PlayMode, Track } from '@music-together/shared'
import { LIMITS } from '@music-together/shared'
import { roomRepo } from '../repositories/roomRepository.js'

export function addTrack(roomId: string, track: Track): boolean {
  const room = roomRepo.get(roomId)
  if (!room) return false
  if (room.queue.length >= LIMITS.QUEUE_MAX_SIZE) return false
  room.queue.push(track)
  return true
}

/**
 * Add multiple tracks at once (from playlist import).
 * Respects QUEUE_MAX_SIZE — adds as many as fit.
 * @returns Number of tracks actually added.
 */
export function addBatchTracks(roomId: string, tracks: Track[]): number {
  const room = roomRepo.get(roomId)
  if (!room) return 0
  const available = LIMITS.QUEUE_MAX_SIZE - room.queue.length
  if (available <= 0) return 0
  const toAdd = tracks.slice(0, available)
  room.queue.push(...toAdd)
  return toAdd.length
}

export function removeTrack(roomId: string, trackId: string): void {
  const room = roomRepo.get(roomId)
  if (room) {
    room.queue = room.queue.filter((t) => t.id !== trackId)
  }
}

export function clearQueue(roomId: string): void {
  const room = roomRepo.get(roomId)
  if (room) {
    room.queue = []
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
  // Append any tracks that were NOT included in trackIds (prevent accidental drops)
  for (const track of room.queue) {
    if (!seen.has(track.id)) {
      reordered.push(track)
    }
  }
  room.queue = reordered
}

/**
 * Get the next track based on the play mode.
 *
 * - sequential: next in queue; null at end
 * - loop-all:   next in queue; wraps to first at end
 * - loop-one:   returns the current track itself
 * - shuffle:    random track from queue (excludes current; returns self if queue has 1 item)
 */
export function getNextTrack(roomId: string, playMode?: PlayMode): Track | null {
  const room = roomRepo.get(roomId)
  if (!room || room.queue.length === 0) return null

  const mode = playMode ?? room.playMode ?? 'sequential'

  const currentIndex = room.currentTrack
    ? room.queue.findIndex((t) => t.id === room.currentTrack!.id)
    : -1

  switch (mode) {
    case 'loop-one':
      // Replay the current track; fall back to next if current is gone
      if (room.currentTrack && currentIndex >= 0) return room.currentTrack
      return room.queue[0] ?? null

    case 'loop-all': {
      const nextIndex = currentIndex + 1
      return nextIndex < room.queue.length
        ? room.queue[nextIndex]
        : room.queue[0] // wrap to first
    }

    case 'shuffle': {
      if (room.queue.length === 1) return room.queue[0]
      // Pick a random track excluding the current one
      const candidates = room.queue.filter((_, i) => i !== currentIndex)
      return candidates[Math.floor(Math.random() * candidates.length)] ?? room.queue[0]
    }

    case 'sequential':
    default: {
      const nextIndex = currentIndex + 1
      return nextIndex < room.queue.length ? room.queue[nextIndex] : null
    }
  }
}

export function getPreviousTrack(roomId: string): Track | null {
  const room = roomRepo.get(roomId)
  if (!room || room.queue.length === 0) return null

  const currentIndex = room.currentTrack
    ? room.queue.findIndex((t) => t.id === room.currentTrack!.id)
    : -1

  // For loop-all, wrap to last track when at the beginning
  if (room.playMode === 'loop-all' && currentIndex <= 0) {
    return room.queue[room.queue.length - 1]
  }

  const prevIndex = currentIndex - 1
  return prevIndex >= 0 ? room.queue[prevIndex] : null
}
