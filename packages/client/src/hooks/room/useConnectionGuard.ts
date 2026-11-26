import { useSocketContext } from '@/providers/SocketProvider'
import { resetAllRoomState } from '@/lib/resetStores'
import { useEffect } from 'react'
import { stopActiveAudio } from '@/lib/audioPlaybackLifecycle'
import { cancelScheduledPlay } from '@/lib/scheduledPlayback'
import { roomCommands } from '@/lib/RoomCommands'
import { useRoomStore } from '@/stores/roomStore'
import { TIMING } from '@music-together/shared'

export const OFFLINE_RESET_TIMEOUT_MS = TIMING.ROOM_GRACE_PERIOD_MS

/** Keep the current sound alive while RoomPage restores the room. */
export function useConnectionGuard() {
  const { socket } = useSocketContext()

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined
    const clearOfflineTimeout = () => {
      clearTimeout(timeout)
      timeout = undefined
    }
    const onDisconnect = () => {
      const store = useRoomStore.getState()
      if (!store.room) return
      cancelScheduledPlay()
      store.setConnectionStatus('reconnecting')
      if (timeout !== undefined) return
      timeout = setTimeout(() => {
        timeout = undefined
        if (useRoomStore.getState().connectionStatus !== 'reconnecting') return
        stopActiveAudio()
        roomCommands.leave(socket)
        resetAllRoomState()
      }, OFFLINE_RESET_TIMEOUT_MS)
    }
    const unsubscribe = useRoomStore.subscribe(({ room, connectionStatus }) => {
      if (!room || connectionStatus === 'connected') clearOfflineTimeout()
    })

    socket.on('disconnect', onDisconnect)

    return () => {
      clearOfflineTimeout()
      unsubscribe()
      socket.off('disconnect', onDisconnect)
    }
  }, [socket])
}
