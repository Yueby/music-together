import { useSocketContext } from '@/providers/SocketProvider'
import { useChatStore } from '@/stores/chatStore'
import { useRoomStore } from '@/stores/roomStore'
import { resetAllRoomState } from '@/lib/resetStores'
import type { ChatMessage, RoomState, Track, User } from '@music-together/shared'
import { EVENTS } from '@music-together/shared'
import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

export function useRoom() {
  const navigate = useNavigate()
  const { socket } = useSocketContext()
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  useEffect(() => {
    // Named handlers — passed to both on() and off() so we only remove our own listeners
    const onRoomState = (roomState: RoomState) => {
      useRoomStore.getState().setRoom(roomState)
      const me = roomState.users.find((u) => u.id === socket.id)
      if (me) {
        useRoomStore.getState().setCurrentUser({ ...me, isHost: roomState.hostId === socket.id })
      }
    }

    const onUserJoined = (user: User) => {
      useRoomStore.getState().addUser(user)
      useChatStore.getState().addMessage({
        id: crypto.randomUUID(),
        userId: 'system',
        nickname: 'system',
        content: `${user.nickname} 加入了房间`,
        timestamp: Date.now(),
        type: 'system',
      })
    }

    const onUserLeft = (user: User) => {
      useRoomStore.getState().removeUser(user.id)
      useChatStore.getState().addMessage({
        id: crypto.randomUUID(),
        userId: 'system',
        nickname: 'system',
        content: `${user.nickname} 离开了房间`,
        timestamp: Date.now(),
        type: 'system',
      })
    }

    const onSettings = (settings: { mode: RoomState['mode']; hasPassword: boolean }) => {
      useRoomStore.getState().updateRoom(settings)
    }

    const onError = (error: { code: string; message: string }) => {
      toast.error(error.message)
      if (error.code === 'ROOM_NOT_FOUND') {
        navigateRef.current('/', { replace: true })
      }
    }

    const onChatHistory = (messages: ChatMessage[]) => {
      useChatStore.getState().setMessages(messages)
    }

    const onChatMessage = (message: ChatMessage) => {
      useChatStore.getState().addMessage(message)
    }

    const onQueueUpdated = (data: { queue: Track[] }) => {
      const room = useRoomStore.getState().room
      if (room) {
        useRoomStore.getState().updateRoom({ queue: data.queue })
      }
    }

    const onDisconnect = () => {
      resetAllRoomState()
    }

    // Re-join on reconnect is handled by RoomPage's auto-join effect
    // which monitors isConnected and room state, so no onConnect handler needed here.

    socket.on(EVENTS.ROOM_STATE, onRoomState)
    socket.on(EVENTS.ROOM_USER_JOINED, onUserJoined)
    socket.on(EVENTS.ROOM_USER_LEFT, onUserLeft)
    socket.on(EVENTS.ROOM_SETTINGS, onSettings)
    socket.on(EVENTS.ROOM_ERROR, onError)
    socket.on(EVENTS.CHAT_HISTORY, onChatHistory)
    socket.on(EVENTS.CHAT_MESSAGE, onChatMessage)
    socket.on(EVENTS.QUEUE_UPDATED, onQueueUpdated)
    socket.on('disconnect', onDisconnect)

    return () => {
      socket.off(EVENTS.ROOM_STATE, onRoomState)
      socket.off(EVENTS.ROOM_USER_JOINED, onUserJoined)
      socket.off(EVENTS.ROOM_USER_LEFT, onUserLeft)
      socket.off(EVENTS.ROOM_SETTINGS, onSettings)
      socket.off(EVENTS.ROOM_ERROR, onError)
      socket.off(EVENTS.CHAT_HISTORY, onChatHistory)
      socket.off(EVENTS.CHAT_MESSAGE, onChatMessage)
      socket.off(EVENTS.QUEUE_UPDATED, onQueueUpdated)
      socket.off('disconnect', onDisconnect)
    }
  }, [socket])

  const leaveRoom = useCallback(() => {
    socket.emit(EVENTS.ROOM_LEAVE)
    resetAllRoomState()
  }, [socket])

  const updateSettings = useCallback(
    (settings: { mode?: 'host-only' | 'collaborative'; password?: string | null }) => {
      socket.emit(EVENTS.ROOM_SETTINGS, settings)
    },
    [socket],
  )

  return { leaveRoom, updateSettings }
}
