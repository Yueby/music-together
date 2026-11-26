import { useCallback } from 'react'
import { EVENTS, type Track } from '@music-together/shared'
import { useSocketContext } from '@/providers/SocketProvider'
import { canSendRoomCommand } from '@/stores/roomStore'

export function useQueue() {
  const { socket } = useSocketContext()

  const addTrack = useCallback((track: Track) => {
    if (canSendRoomCommand(socket)) socket.emit(EVENTS.QUEUE_ADD, { track })
  }, [socket])

  const insertAfterCurrent = useCallback(
    (track: Track) => {
      if (canSendRoomCommand(socket)) socket.emit(EVENTS.QUEUE_INSERT_AFTER_CURRENT, { track })
    },
    [socket],
  )

  const addBatchTracks = useCallback(
    (tracks: Track[], playlistName?: string) => {
      if (canSendRoomCommand(socket)) socket.emit(EVENTS.QUEUE_ADD_BATCH, { tracks, playlistName })
    },
    [socket],
  )

  const removeTrack = useCallback((trackId: string) => {
    if (canSendRoomCommand(socket)) socket.emit(EVENTS.QUEUE_REMOVE, { trackId })
  }, [socket])

  const reorderTracks = useCallback((trackIds: string[]) => {
    if (canSendRoomCommand(socket)) socket.emit(EVENTS.QUEUE_REORDER, { trackIds })
  }, [socket])

  const clearQueue = useCallback(() => {
    if (canSendRoomCommand(socket)) socket.emit(EVENTS.QUEUE_CLEAR)
  }, [socket])

  return { addTrack, insertAfterCurrent, addBatchTracks, removeTrack, reorderTracks, clearQueue }
}
