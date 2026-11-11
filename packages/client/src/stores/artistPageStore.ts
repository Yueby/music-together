import { create } from 'zustand'
import type { MusicSource } from '@music-together/shared'

/** The artist to show: by platform id when the track knew it, otherwise found by name. */
export interface ArtistTarget {
  source: MusicSource
  id?: string
  name: string
}

interface ArtistPageStore {
  /** The artist page that is open, if any. One page for the whole app, whatever opened it (a song, the queue, a search). */
  target: ArtistTarget | null
  open: (target: ArtistTarget) => void
  close: () => void
}

export const useArtistPageStore = create<ArtistPageStore>((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null }),
}))

/** Open the artist page from anywhere (an event handler; no hook needed). */
export function openArtistPage(target: ArtistTarget): void {
  useArtistPageStore.getState().open(target)
}
