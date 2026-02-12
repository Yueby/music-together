import type { RoomListItem } from '@music-together/shared'
import type { RoomData, RoomRepository, SocketMapping } from './types.js'

export class InMemoryRoomRepository implements RoomRepository {
  private rooms = new Map<string, RoomData>()
  private socketToRoom = new Map<string, SocketMapping>()

  get(roomId: string): RoomData | undefined {
    return this.rooms.get(roomId)
  }

  set(roomId: string, room: RoomData): void {
    this.rooms.set(roomId, room)
  }

  delete(roomId: string): void {
    this.rooms.delete(roomId)
  }

  getAll(): Map<string, RoomData> {
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
  }
}

/** Singleton instance */
export const roomRepo = new InMemoryRoomRepository()
