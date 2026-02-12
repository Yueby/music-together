import { useSocketContext } from '@/providers/SocketProvider'
import { useLobbyStore } from '@/stores/lobbyStore'
import { EVENTS, type RoomListItem } from '@music-together/shared'
import { useCallback, useEffect } from 'react'

export function useLobby() {
  const { socket } = useSocketContext()
  const rooms = useLobbyStore((s) => s.rooms)
  const isLoading = useLobbyStore((s) => s.isLoading)

  useEffect(() => {
    // Request room list on mount
    socket.emit(EVENTS.ROOM_LIST)

    // Listen for real-time room list updates
    const handler = (rooms: RoomListItem[]) => {
      useLobbyStore.getState().setRooms(rooms)
    }
    socket.on(EVENTS.ROOM_LIST_UPDATE, handler)

    return () => {
      socket.off(EVENTS.ROOM_LIST_UPDATE, handler)
    }
  }, [socket])

  const createRoom = useCallback(
    (nickname: string, roomName?: string, password?: string) => {
      socket.emit(EVENTS.ROOM_CREATE, { nickname, roomName, password })
    },
    [socket],
  )

  const joinRoom = useCallback(
    (roomId: string, nickname: string, password?: string) => {
      socket.emit(EVENTS.ROOM_JOIN, { roomId, nickname, password })
    },
    [socket],
  )

  return { rooms, isLoading, createRoom, joinRoom }
}
