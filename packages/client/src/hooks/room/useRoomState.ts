import { useSocketContext } from '@/providers/SocketProvider'
import { useRoomStore } from '@/stores/roomStore'
import { storage } from '@/lib/storage'
import { ERROR_CODE, EVENTS } from '@music-together/shared'
import type { RoomState, User, UserRole } from '@music-together/shared'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

/**
 * Handles core room lifecycle events:
 * ROOM_STATE, ROOM_USER_JOINED/LEFT, ROOM_SETTINGS, ROOM_ROLE_CHANGED, ROOM_ERROR.
 *
 * Also auto-resends persisted auth cookies on ROOM_STATE (join/reconnect).
 */
export function useRoomState() {
  const navigate = useNavigate()
  const { socket } = useSocketContext()
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  useEffect(() => {
    const onRoomState = (roomState: RoomState) => {
      useRoomStore.getState().setRoom(roomState)
      const me = roomState.users.find((u) => u.id === socket.id)
      if (me) {
        const role: UserRole = roomState.hostId === socket.id ? 'host' : me.role
        useRoomStore.getState().setCurrentUser({ ...me, role })
      }

      // Auto-resend persisted auth cookies so the room's cookie pool is populated
      const storedCookies = storage.getAuthCookies()
      for (const { platform, cookie } of storedCookies) {
        socket.emit(EVENTS.AUTH_SET_COOKIE, { platform, cookie })
      }
    }

    const onUserJoined = (user: User) => {
      useRoomStore.getState().addUser(user)
    }

    const onUserLeft = (user: User) => {
      useRoomStore.getState().removeUser(user.id)
    }

    const onSettings = (settings: { name: string; hasPassword: boolean }) => {
      useRoomStore.getState().updateRoom(settings)
    }

    const onRoleChanged = (data: { userId: string; role: UserRole }) => {
      const store = useRoomStore.getState()
      const room = store.room
      if (!room) return
      const updatedUsers = room.users.map((u) =>
        u.id === data.userId ? { ...u, role: data.role } : u,
      )
      store.updateRoom({ users: updatedUsers })
      if (data.userId === store.currentUser?.id) {
        store.setCurrentUser({ ...store.currentUser, role: data.role })
      }
    }

    const onError = (error: { code: string; message: string }) => {
      toast.error(error.message)
      if (error.code === ERROR_CODE.ROOM_NOT_FOUND) {
        navigateRef.current('/', { replace: true })
      }
    }

    socket.on(EVENTS.ROOM_STATE, onRoomState)
    socket.on(EVENTS.ROOM_USER_JOINED, onUserJoined)
    socket.on(EVENTS.ROOM_USER_LEFT, onUserLeft)
    socket.on(EVENTS.ROOM_SETTINGS, onSettings)
    socket.on(EVENTS.ROOM_ROLE_CHANGED, onRoleChanged)
    socket.on(EVENTS.ROOM_ERROR, onError)

    return () => {
      socket.off(EVENTS.ROOM_STATE, onRoomState)
      socket.off(EVENTS.ROOM_USER_JOINED, onUserJoined)
      socket.off(EVENTS.ROOM_USER_LEFT, onUserLeft)
      socket.off(EVENTS.ROOM_SETTINGS, onSettings)
      socket.off(EVENTS.ROOM_ROLE_CHANGED, onRoleChanged)
      socket.off(EVENTS.ROOM_ERROR, onError)
    }
  }, [socket])
}
