import type { RoomListItem } from '@music-together/shared'
import type { RoomData, RoomRepository, SocketMapping } from './types.js'

export class InMemoryRoomRepository implements RoomRepository {
  private rooms = new Map<string, RoomData>()
  private socketToRoom = new Map<string, SocketMapping>()
  /** Smoothed RTT per socket (ms).  Cleaned up together with socket mapping. */
  private socketRTT = new Map<string, number>()
  /** Reverse index: roomId → Set of socketIds.  Keeps getMaxRTT O(room sockets) instead of O(all sockets). */
  private roomToSockets = new Map<string, Set<string>>()

  get(roomId: string): RoomData | undefined {
    return this.rooms.get(roomId)
  }

  set(roomId: string, room: RoomData): void {
    this.rooms.set(roomId, room)
  }

  delete(roomId: string): void {
    this.rooms.delete(roomId)
    // Clean up reverse index for the deleted room
    this.roomToSockets.delete(roomId)
  }

  getAll(): ReadonlyMap<string, RoomData> {
    return this.rooms
  }

  getAllIds(): string[] {
    return Array.from(this.rooms.keys())
  }

  getAllAsList(): RoomListItem[] {
    return Array.from(this.rooms.values()).map((room) => ({
      id: room.id,
      name: room.name,
      hasPassword: room.password !== null,
      userCount: room.users.length,
      currentTrackTitle: room.currentTrack?.title ?? null,
      currentTrackArtist: room.currentTrack?.artist.join(', ') ?? null,
    }))
  }

  setSocketMapping(socketId: string, roomId: string, userId: string): void {
    // Remove from previous room's reverse index (if socket was mapped before)
    const prev = this.socketToRoom.get(socketId)
    if (prev) {
      const prevSet = this.roomToSockets.get(prev.roomId)
      if (prevSet) {
        prevSet.delete(socketId)
        if (prevSet.size === 0) this.roomToSockets.delete(prev.roomId)
      }
    }

    this.socketToRoom.set(socketId, { roomId, userId })

    // Add to new room's reverse index
    let socketSet = this.roomToSockets.get(roomId)
    if (!socketSet) {
      socketSet = new Set()
      this.roomToSockets.set(roomId, socketSet)
    }
    socketSet.add(socketId)
  }

  getSocketMapping(socketId: string): SocketMapping | undefined {
    return this.socketToRoom.get(socketId)
  }

  deleteSocketMapping(socketId: string): void {
    // Remove from reverse index
    const mapping = this.socketToRoom.get(socketId)
    if (mapping) {
      const socketSet = this.roomToSockets.get(mapping.roomId)
      if (socketSet) {
        socketSet.delete(socketId)
        if (socketSet.size === 0) this.roomToSockets.delete(mapping.roomId)
      }
    }

    this.socketToRoom.delete(socketId)
    this.socketRTT.delete(socketId)
  }

  hasOtherSocketForUser(roomId: string, userId: string, excludeSocketId: string): boolean {
    const sockets = this.roomToSockets.get(roomId)
    if (!sockets) return false
    for (const sid of sockets) {
      if (sid === excludeSocketId) continue
      const mapping = this.socketToRoom.get(sid)
      if (mapping && mapping.userId === userId && mapping.roomId === roomId) return true
    }
    return false
  }

  setSocketRTT(socketId: string, rttMs: number): void {
    const prev = this.socketRTT.get(socketId)
    if (prev === undefined) {
      this.socketRTT.set(socketId, rttMs)
    } else {
      // Exponential moving average (alpha = 0.2) for smoothing
      this.socketRTT.set(socketId, prev * 0.8 + rttMs * 0.2)
    }
  }

  getSocketRTT(socketId: string): number {
    return this.socketRTT.get(socketId) ?? 0
  }

  getMaxRTT(roomId: string): number {
    const sockets = this.roomToSockets.get(roomId)
    if (!sockets) return 0
    let max = 0
    for (const socketId of sockets) {
      const rtt = this.socketRTT.get(socketId) ?? 0
      if (rtt > max) max = rtt
    }
    return max
  }
}

/** Singleton instance */
export const roomRepo = new InMemoryRoomRepository()
