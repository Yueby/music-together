import type { Server } from 'socket.io'
import { EVENTS } from '@music-together/shared'
import * as roomManager from '../services/roomManager.js'

const BROADCAST_INTERVAL_MS = 10000 // 10 seconds

/**
 * Starts a periodic sync broadcast that pushes playback position
 * to all clients in active rooms. Complements client-initiated sync requests.
 */
export function startSyncEngine(io: Server) {
  setInterval(() => {
    // Iterate all rooms with an active playState
    for (const roomId of roomManager.getAllRoomIds()) {
      const room = roomManager.getRoom(roomId)
      if (!room || !room.playState.isPlaying || !room.currentTrack) continue

      io.to(roomId).emit(EVENTS.PLAYER_SYNC_RESPONSE, {
        currentTime: estimateCurrentTime(roomId),
        isPlaying: room.playState.isPlaying,
        serverTimestamp: Date.now(),
      })
    }
  }, BROADCAST_INTERVAL_MS)
}

/**
 * Estimate the current playback position for a room.
 * Uses the stored currentTime and elapsed time since last update.
 */
export function estimateCurrentTime(roomId: string): number {
  const room = roomManager.getRoom(roomId)
  if (!room) return 0

  const { playState } = room
  if (!playState.isPlaying) return playState.currentTime

  const elapsed = (Date.now() - playState.serverTimestamp) / 1000
  return playState.currentTime + elapsed
}
