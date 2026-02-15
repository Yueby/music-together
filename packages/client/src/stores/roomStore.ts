import { create } from 'zustand'
import { storage } from '@/lib/storage'
import type { RoomState, User, UserRole } from '@music-together/shared'

/**
 * Derive the current user (with correct role) from the authoritative room.users list.
 * This ensures `currentUser` is ALWAYS in sync with `room.users` — they can never diverge.
 */
function deriveCurrentUser(room: RoomState | null): User | null {
  if (!room) return null
  const myId = storage.getUserId()
  const me = room.users.find((u) => u.id === myId)
  if (!me) return null
  const role: UserRole = room.hostId === myId ? 'host' : me.role
  // Avoid unnecessary object creation if role is already correct
  return role !== me.role ? { ...me, role } : me
}

interface RoomStore {
  room: RoomState | null
  currentUser: User | null

  setRoom: (room: RoomState | null) => void
  updateRoom: (partial: Partial<RoomState>) => void
  addUser: (user: User) => void
  removeUser: (userId: string) => void
  reset: () => void
}

export const useRoomStore = create<RoomStore>((set) => ({
  room: null,
  currentUser: null,

  setRoom: (room) => set({ room, currentUser: deriveCurrentUser(room) }),

  updateRoom: (partial) =>
    set((state) => {
      if (!state.room) return {}
      const room = { ...state.room, ...partial }
      // Re-derive currentUser when users list or hostId changed
      if ('users' in partial || 'hostId' in partial) {
        return { room, currentUser: deriveCurrentUser(room) }
      }
      return { room }
    }),

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

  reset: () => set({ room: null, currentUser: null }),
}))
