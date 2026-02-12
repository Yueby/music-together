import { useChatStore } from '@/stores/chatStore'
import { usePlayerStore } from '@/stores/playerStore'
import { useRoomStore } from '@/stores/roomStore'
import { EVENTS, type RoomState, type User } from '@music-together/shared'
import { useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Socket } from 'socket.io-client'
import { toast } from 'sonner'

export function useRoom(socket: Socket) {
  const navigate = useNavigate()
  const { setRoom, setCurrentUser, addUser, removeUser } = useRoomStore()
  const { setQueue } = usePlayerStore()
  const { addMessage } = useChatStore()

  useEffect(() => {
    socket.on(EVENTS.ROOM_STATE, (roomState: RoomState) => {
      setRoom(roomState)
      setQueue(roomState.queue)
      // NOTE: currentTrack, isPlaying, currentTime are NOT set here.
      // Audio playback state is exclusively owned by usePlayer via PLAYER_PLAY events.
      // This prevents dual-write conflicts during room join.

      // Restore currentUser from room state (important after page refresh)
      const me = roomState.users.find((u) => u.id === socket.id)
      if (me) {
        setCurrentUser({ ...me, isHost: roomState.hostId === socket.id })
      }
    })

    socket.on(EVENTS.ROOM_USER_JOINED, (user: User) => {
      addUser(user)
      addMessage({
        id: crypto.randomUUID(),
        userId: 'system',
        nickname: 'system',
        content: `${user.nickname} 加入了房间`,
        timestamp: Date.now(),
        type: 'system',
      })
    })

    socket.on(EVENTS.ROOM_USER_LEFT, (user: User) => {
      removeUser(user.id)
      addMessage({
        id: crypto.randomUUID(),
        userId: 'system',
        nickname: 'system',
        content: `${user.nickname} 离开了房间`,
        timestamp: Date.now(),
        type: 'system',
      })
    })

    socket.on(EVENTS.ROOM_SETTINGS, (settings: Partial<RoomState>) => {
      useRoomStore.getState().updateRoom(settings)
    })

    socket.on(EVENTS.ROOM_ERROR, (error: { code?: string; message: string }) => {
      toast.error(error.message)
      // Room not found — redirect to home
      if (error.code === 'ROOM_NOT_FOUND') {
        navigate('/', { replace: true })
      }
    })

    return () => {
      socket.off(EVENTS.ROOM_STATE)
      socket.off(EVENTS.ROOM_USER_JOINED)
      socket.off(EVENTS.ROOM_USER_LEFT)
      socket.off(EVENTS.ROOM_SETTINGS)
      socket.off(EVENTS.ROOM_ERROR)
    }
  }, [socket, navigate, setRoom, setCurrentUser, addUser, removeUser, setQueue, addMessage])

  const createRoom = useCallback(
    (nickname: string) => {
      socket.emit(EVENTS.ROOM_CREATE, { nickname })
    },
    [socket],
  )

  const joinRoom = useCallback(
    (roomId: string, nickname: string) => {
      socket.emit(EVENTS.ROOM_JOIN, { roomId, nickname })
    },
    [socket],
  )

  const leaveRoom = useCallback(() => {
    socket.emit(EVENTS.ROOM_LEAVE)
  }, [socket])

  const updateSettings = useCallback(
    (settings: { mode: 'host-only' | 'collaborative' }) => {
      socket.emit(EVENTS.ROOM_SETTINGS, settings)
    },
    [socket],
  )

  return { createRoom, joinRoom, leaveRoom, updateSettings }
}
