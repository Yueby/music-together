import { create } from 'zustand'
import { storage } from '@/lib/storage'
import type { RoomState, User } from '@music-together/shared'

/**
 * Derive the current user from the authoritative room.users list.
 * Role is purely permission-based (owner/admin/member) — no client-side override.
 */
function deriveCurrentUser(room: RoomState | null): User | null {
  if (!room) return null
  const myId = storage.getUserId()
  return room.users.find((u) => u.id === myId) ?? null
}

interface RoomStore {
  room: RoomState | null
  currentUser: User | null
  /** 房间密码明文（从 ROOM_SETTINGS 事件接收） */
  roomPassword: string | null

  setRoom: (room: RoomState | null) => void
  updateRoom: (partial: Partial<RoomState>) => void
  setRoomPassword: (password: string | null) => void
  addUser: (user: User) => void
  removeUser: (userId: string) => void
  reset: () => void
}

export const useRoomStore = create<RoomStore>((set) => ({
  room: null,
  currentUser: null,
  roomPassword: null,

  setRoom: (room) => set({ room, currentUser: deriveCurrentUser(room) }),

  updateRoom: (partial) =>
    set((state) => {
      if (!state.room) return {}
      const room = { ...state.room, ...partial }
      // Re-derive currentUser when users list changed (role may have been updated by server)
      if ('users' in partial) {
        return { room, currentUser: deriveCurrentUser(room) }
      }
      return { room }
    }),

  setRoomPassword: (password) => set({ roomPassword: password }),

  addUser: (user) =>
    set((state) => {
      if (!state.room) return {}
      const room = { ...state.room, users: [...state.room.users, user] }
      const myId = storage.getUserId()
      if (user.id === myId) {
        // The added user is us — derive our currentUser from the updated room
        return { room, currentUser: deriveCurrentUser(room) }
      }
      return { room }
    }),

  removeUser: (userId) =>
    set((state) => {
      if (!state.room) return {}
      const room = { ...state.room, users: state.room.users.filter((u) => u.id !== userId) }
      const myId = storage.getUserId()
      if (userId === myId) {
        // We were removed — clear currentUser
        return { room, currentUser: null }
      }
      return { room }
    }),

  reset: () => set({ room: null, currentUser: null, roomPassword: null }),
}))
