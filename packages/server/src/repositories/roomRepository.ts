import type { RoomListItem } from '@music-together/shared'
import type { RoomData, RoomRepository, SocketMapping } from './types.js'

export class InMemoryRoomRepository implements RoomRepository {
  private rooms = new Map<string, RoomData>()
  private socketToRoom = new Map<string, SocketMapping>()
  /** Smoothed RTT per socket (ms).  Cleaned up together with socket mapping. */
  private socketRTT = new Map<string, number>()

  get(roomId: string): RoomData | undefined {
    return this.rooms.get(roomId)
  }

  set(roomId: string, room: RoomData): void {
    this.rooms.set(roomId, room)
  }

  delete(roomId: string): void {
    this.rooms.delete(roomId)
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
    this.socketToRoom.set(socketId, { roomId, userId })
  }

  getSocketMapping(socketId: string): SocketMapping | undefined {
    return this.socketToRoom.get(socketId)
  }

  deleteSocketMapping(socketId: string): void {
    this.socketToRoom.delete(socketId)
    this.socketRTT.delete(socketId)
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
    const room = this.rooms.get(roomId)
    if (!room) return 0
    let max = 0
    // Walk through all socket mappings to find sockets in this room
    for (const [socketId, mapping] of this.socketToRoom) {
      if (mapping.roomId === roomId) {
        const rtt = this.socketRTT.get(socketId) ?? 0
        if (rtt > max) max = rtt
      }
    }
    return max
  }
}

/** Singleton instance */
export const roomRepo = new InMemoryRoomRepository()
