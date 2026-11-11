/**
 * Cooldown after an automatic source fallback for a track: stops the same unplayable track from being retried (and
 * bounced between sources) over and over. Kept per room so a room that is gone takes its entries with it.
 */
export function createFallbackCooldown(now: () => number = Date.now) {
  const rooms = new Map<string, Map<string, number>>()

  return {
    /** Whether the track may be tried again now. An expired entry is dropped on the way. */
    canTry(roomId: string, trackId: string): boolean {
      const until = rooms.get(roomId)?.get(trackId)
      if (until === undefined) return true
      if (now() >= until) {
        rooms.get(roomId)?.delete(trackId)
        return true
      }
      return false
    },

    /** Block the track for `ms` from now. */
    mark(roomId: string, trackId: string, ms: number): void {
      let tracks = rooms.get(roomId)
      if (!tracks) rooms.set(roomId, (tracks = new Map()))
      tracks.set(trackId, now() + ms)
    },

    /** Forget everything about a room (it was destroyed). */
    clearRoom(roomId: string): void {
      rooms.delete(roomId)
    },
  }
}

export const fallbackCooldown = createFallbackCooldown()
