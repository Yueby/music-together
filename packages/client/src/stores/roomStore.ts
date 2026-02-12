import { create } from 'zustand'
import type { RoomState, User } from '@music-together/shared'

interface RoomStore {
  room: RoomState | null
  currentUser: User | null

  setRoom: (room: RoomState | null) => void
  setCurrentUser: (user: User | null) => void
  updateRoom: (partial: Partial<RoomState>) => void
  addUser: (user: User) => void
  removeUser: (userId: string) => void
  reset: () => void
}

export const useRoomStore = create<RoomStore>((set) => ({
  room: null,
  currentUser: null,

  setRoom: (room) => set({ room }),
  setCurrentUser: (user) => set({ currentUser: user }),
  updateRoom: (partial) =>
    set((state) => ({
      room: state.room ? { ...state.room, ...partial } : null,
    })),
  addUser: (user) =>
    set((state) => ({
      room: state.room
        ? { ...state.room, users: [...state.room.users, user] }
        : null,
    })),
  removeUser: (userId) =>
    set((state) => ({
      room: state.room
        ? { ...state.room, users: state.room.users.filter((u) => u.id !== userId) }
        : null,
    })),
  reset: () => set({ room: null, currentUser: null }),
}))
