import { create } from 'zustand'
import type { RoomListItem } from '@music-together/shared'

interface LobbyStore {
  rooms: RoomListItem[]
  isLoading: boolean

  setRooms: (rooms: RoomListItem[]) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

export const useLobbyStore = create<LobbyStore>((set) => ({
  rooms: [],
  isLoading: true,

  setRooms: (rooms) => set({ rooms, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ rooms: [], isLoading: true }),
}))
