import { useRoomStore } from '@/stores/roomStore'
import { usePlayerStore } from '@/stores/playerStore'
import { useChatStore } from '@/stores/chatStore'

/** Reset all room-related stores at once (used on leave/disconnect) */
export function resetAllRoomState() {
  useRoomStore.getState().reset()
  usePlayerStore.getState().reset()
  useChatStore.getState().reset()
}
