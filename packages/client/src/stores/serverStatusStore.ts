import { create } from 'zustand'
import type { AdmissionQueuedEvent, ServerCapacityStatus } from '@music-together/shared'

interface ServerStatusStore {
  capacity: ServerCapacityStatus | null
  admissionQueue: AdmissionQueuedEvent | null
  setCapacity: (capacity: ServerCapacityStatus) => void
  setAdmissionQueue: (queued: AdmissionQueuedEvent | null) => void
  clearAdmissionQueue: () => void
  reset: () => void
}

export const useServerStatusStore = create<ServerStatusStore>((set) => ({
  capacity: null,
  admissionQueue: null,
  setCapacity: (capacity) =>
    set((state) => ({
      capacity,
      admissionQueue: state.admissionQueue ? { ...state.admissionQueue, capacity } : null,
    })),
  setAdmissionQueue: (admissionQueue) =>
    set((state) => ({
      admissionQueue,
      capacity: admissionQueue ? admissionQueue.capacity : state.capacity,
    })),
  clearAdmissionQueue: () => set({ admissionQueue: null }),
  reset: () => set({ capacity: null, admissionQueue: null }),
}))
