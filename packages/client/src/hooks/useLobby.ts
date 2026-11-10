import { storage } from '@/lib/storage'
import { roomCommands } from '@/lib/RoomCommands'
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
      if (socket.connected) socket.emit(EVENTS.ROOM_LIST)
    }

    requestList()
    socket.on('connect', requestList)
    return () => {
      socket.off('connect', requestList)
    }
  }, [socket])

  // Listen for real-time room list updates
  useSocketEvent(
    EVENTS.ROOM_LIST_UPDATE,
    useCallback((rooms: RoomListItem[]) => {
      useLobbyStore.getState().setRooms(rooms)
    }, []),
  )

  const createRoom = useCallback(
    (nickname: string, roomName?: string, password?: string) => {
      roomCommands.create(socket, { nickname, roomName, password })
    },
    [socket],
  )

  const joinRoom = useCallback(
    (roomId: string, nickname: string, password?: string) => {
      roomCommands.join(socket, {
        roomId,
        nickname,
        password,
        rejoinToken: storage.getRejoinToken(roomId) ?? undefined,
      })
    },
    [socket],
  )

  return { rooms, isLoading, createRoom, joinRoom }
}
