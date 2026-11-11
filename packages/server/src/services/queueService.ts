import type { PlayMode, Track } from '@music-together/shared'
import { effectivePlayMode, LIMITS } from '@music-together/shared'
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

/**
 * Insert a new track right after the current playing track.
 * If current track is missing from the queue (edge race), insert to the front.
 */
export function insertAfterCurrent(roomId: string, track: Track): boolean {
  const room = roomRepo.get(roomId)
  if (!room) return false
  if (room.queue.length >= LIMITS.QUEUE_MAX_SIZE) return false

  const currentId = room.currentTrack?.id
  const currentIndex = currentId ? room.queue.findIndex((t) => t.id === currentId) : -1
  const insertIndex = currentIndex >= 0 ? currentIndex + 1 : 0
  room.queue.splice(insertIndex, 0, track)
  return true
}

export function removeTrack(roomId: string, trackId: string): void {
  const room = roomRepo.get(roomId)
  if (room) {
    room.queue = room.queue.filter((t) => t.id !== trackId)
  }
}

/** Resolve the track that should follow a removed current item, using the queue before removal. */
export function getSuccessorAfterRemoval(roomId: string, trackId: string, playMode: PlayMode): Track | null {
  const room = roomRepo.get(roomId)
  if (!room || room.queue.length === 0) return null
  const removedIndex = room.queue.findIndex((track) => track.id === trackId)
  if (removedIndex < 0) return null

  const remaining = room.queue.filter((track) => track.id !== trackId)
  if (remaining.length === 0) return null

  switch (effectivePlayMode(room.queueMode, playMode)) {
    case 'shuffle':
      return remaining[Math.floor(Math.random() * remaining.length)] ?? null
    case 'loop-all':
    case 'loop-one':
      return remaining[removedIndex] ?? remaining[0]
    case 'sequential':
    default:
      return remaining[removedIndex] ?? null
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
export function getNextTrack(roomId: string, playMode?: PlayMode, fromTrackId?: string): Track | null {
  const room = roomRepo.get(roomId)
  if (!room || room.queue.length === 0) return null

  // In a queue that is consumed as it plays, the looping modes mean nothing: it just goes forward.
  const mode = effectivePlayMode(room.queueMode, playMode ?? room.playMode ?? 'sequential')

  // `fromTrackId` lets a caller look past a transition that has been scheduled but not committed yet.
  const fromId = fromTrackId ?? room.currentTrack?.id
  const currentIndex = fromId ? room.queue.findIndex((t) => t.id === fromId) : -1

  switch (mode) {
    case 'loop-one':
      // Replay the current track; fall back to next if current is gone
      if (room.currentTrack && currentIndex >= 0) return room.currentTrack
      return room.queue[0] ?? null

    case 'loop-all': {
      const nextIndex = currentIndex + 1
      return nextIndex < room.queue.length ? room.queue[nextIndex] : room.queue[0] // wrap to first
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
      if (nextIndex < room.queue.length) return room.queue[nextIndex]
      // A consumed queue only holds what has not been heard yet: whatever sits before the current track was jumped
      // over, so it comes next instead of being left behind for good.
      if (room.queueMode === 'consume') return room.queue.find((t) => t.id !== fromId) ?? null
      return null
    }
  }
}

export function getPreviousTrack(roomId: string): Track | null {
  const room = roomRepo.get(roomId)
  if (!room || room.queue.length === 0) return null

  const currentIndex = room.currentTrack ? room.queue.findIndex((t) => t.id === room.currentTrack!.id) : -1

  // For loop-all, wrap to last track when at the beginning
  if (effectivePlayMode(room.queueMode, room.playMode) === 'loop-all' && currentIndex <= 0) {
    return room.queue[room.queue.length - 1]
  }

  const prevIndex = currentIndex - 1
  return prevIndex >= 0 ? room.queue[prevIndex] : null
}
