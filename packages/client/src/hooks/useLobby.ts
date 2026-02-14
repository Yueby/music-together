import { storage } from '@/lib/storage'
import { useSocketContext } from '@/providers/SocketProvider'
import { useLobbyStore } from '@/stores/lobbyStore'
import { EVENTS, type RoomListItem } from '@music-together/shared'
import { useCallback, useEffect } from 'react'
import { useSocketEvent } from './useSocketEvent'

export function useLobby() {
  const { socket } = useSocketContext()
  const rooms = useLobbyStore((s) => s.rooms)
  const isLoading = useLobbyStore((s) => s.isLoading)

  // Request room list on mount and on reconnect
  useEffect(() => {
    const requestList = () => {
      useLobbyStore.getState().setLoading(true)
      socket.emit(EVENTS.ROOM_LIST)
    }

    requestList()
    socket.on('connect', requestList)
    return () => {
      socket.off('connect', requestList)
    }
  }, [socket])

  // Listen for real-time room list updates
  useSocketEvent(EVENTS.ROOM_LIST_UPDATE, useCallback((rooms: RoomListItem[]) => {
    useLobbyStore.getState().setRooms(rooms)
  }, []))

  const createRoom = useCallback(
    (nickname: string, roomName?: string, password?: string) => {
      socket.emit(EVENTS.ROOM_CREATE, { nickname, roomName, password, userId: storage.getUserId() })
    },
    [socket],
  )

  const joinRoom = useCallback(
    (roomId: string, nickname: string, password?: string) => {
      socket.emit(EVENTS.ROOM_JOIN, { roomId, nickname, password, userId: storage.getUserId() })
    },
    [socket],
  )

  return { rooms, isLoading, createRoom, joinRoom }
}
