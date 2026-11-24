import { useRoomStore } from '@/stores/roomStore'
import { usePlayerStore } from '@/stores/playerStore'
import { useChatStore } from '@/stores/chatStore'
import { useArtistPageStore } from '@/stores/artistPageStore'
import { resetClockSync } from '@/lib/clockSync'
import { clearAppQueryCache } from '@/lib/queryClient'

/** Reset all room-related stores at once (used on leave/disconnect) */
export function resetAllRoomState() {
  clearAppQueryCache()
  useRoomStore.getState().reset()
  usePlayerStore.getState().reset()
  useChatStore.getState().reset()
  // An artist page left open must not greet the next room.
  useArtistPageStore.getState().close()
  resetClockSync()
}
