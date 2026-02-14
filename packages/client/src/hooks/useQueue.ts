import { useCallback } from 'react'
import { EVENTS, type Track } from '@music-together/shared'
import { useSocketContext } from '@/providers/SocketProvider'

export function useQueue() {
  const { socket } = useSocketContext()

  const addTrack = useCallback(
    (track: Track) => socket.emit(EVENTS.QUEUE_ADD, { track }),
    [socket],
  )

  const removeTrack = useCallback(
    (trackId: string) => socket.emit(EVENTS.QUEUE_REMOVE, { trackId }),
    [socket],
  )

  const reorderTracks = useCallback(
    (trackIds: string[]) => socket.emit(EVENTS.QUEUE_REORDER, { trackIds }),
    [socket],
  )

  const clearQueue = useCallback(
    () => socket.emit(EVENTS.QUEUE_CLEAR),
    [socket],
  )

  return { addTrack, removeTrack, reorderTracks, clearQueue }
}
