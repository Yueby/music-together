import { useSocketContext } from '@/providers/SocketProvider'
import { useRoomStore } from '@/stores/roomStore'
import { storage } from '@/lib/storage'
import { ERROR_CODE, EVENTS } from '@music-together/shared'
import type { AudioQuality, RoomAutoFallbackEvent, RoomState, User, UserRole } from '@music-together/shared'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

/**
 * Handles core room lifecycle events:
 * ROOM_STATE, ROOM_USER_JOINED/LEFT, ROOM_SETTINGS, ROOM_ROLE_CHANGED, ROOM_ERROR.
 *
 * Also auto-resends persisted auth cookies on ROOM_STATE (join/reconnect).
 *
 * NOTE: `currentUser` is auto-derived inside `roomStore` whenever `room`
 * changes (setRoom / addUser / removeUser / updateRoom).
 */
export function useRoomState() {
  const navigate = useNavigate()
  const { socket } = useSocketContext()
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  // Guard against React Strict Mode double-mount sending cookies twice.
  // Persists across cleanup/re-setup so the second mount is a no-op.
  const mountResendDone = useRef(false)

  useEffect(() => {
    const resendCookies = () => {
      const storedCookies = storage.getAuthCookies()
      for (const { platform, cookie } of storedCookies) {
        socket.emit(EVENTS.AUTH_SET_COOKIE, { platform, cookie })
      }
    }

    const onRoomState = (roomState: RoomState) => {
      // setRoom automatically derives currentUser from room.users
      useRoomStore.getState().setRoom(roomState)
      // 初始化密码（ROOM_STATE 携带密码明文）
      useRoomStore.getState().setRoomPassword(roomState.password ?? null)

      // Auto-resend persisted auth cookies so the room's cookie pool is populated
      resendCookies()
    }

    const onUserJoined = (user: User) => {
      useRoomStore.getState().addUser(user)
    }

    const onRejoinToken = (data: { roomId: string; token: string; expiresAt: number }) => {
      storage.setRejoinToken(data.roomId, data.token, data.expiresAt)
    }

    const onUserLeft = (user: User) => {
      useRoomStore.getState().removeUser(user.id)
    }

    const onSettings = (settings: {
      name: string
      hasPassword: boolean
      password?: string | null
      audioQuality: AudioQuality
    }) => {
      useRoomStore.getState().updateRoom(settings)
      // 存储密码明文（服务端广播）
      if ('password' in settings) {
        useRoomStore.getState().setRoomPassword(settings.password ?? null)
      }
    }

    const onRoleChanged = (data: { userId: string; role: UserRole }) => {
      const store = useRoomStore.getState()
      const room = store.room
      if (!room) return
      const updatedUsers = room.users.map((u) => (u.id === data.userId ? { ...u, role: data.role } : u))
      // updateRoom with users automatically re-derives currentUser
      store.updateRoom({ users: updatedUsers })
    }

    const sourceLabel = (source: 'netease' | 'tencent') => (source === 'netease' ? '网易云' : 'QQ音乐')

    const onAutoFallback = (data: RoomAutoFallbackEvent) => {
      const id = `auto-fallback:${data.attemptId}`
      const from = sourceLabel(data.fromSource)
      const to = sourceLabel(data.toSource)

      if (data.status === 'trying') {
        const reasonLabel =
          data.reasonType === 'VIP_REQUIRED'
            ? '无权限'
            : data.reasonType === 'COPYRIGHT_RESTRICTED'
              ? '版权限制'
              : data.reasonType === 'NO_RESOURCE'
                ? '无资源'
                : data.reasonType === 'TIMEOUT'
                  ? '超时'
                  : '不可用'

        toast.loading(`${from} ${reasonLabel}，正在尝试使用 ${to} 点播…`, { id })
        return
      }

      if (data.status === 'success') {
        toast.success(`已切换到 ${to}，点播成功：${data.trackTitle}`, { id })
        return
      }

      // failed
      type ReasonType = NonNullable<RoomAutoFallbackEvent['reasonType']>
      const reasonMap: Partial<Record<ReasonType, string>> = {
        VIP_REQUIRED: 'VIP/权限',
        COPYRIGHT_RESTRICTED: '版权限制',
        NO_RESOURCE: '无资源',
        TIMEOUT: '超时',
      }
      const reasonText = data.reasonType ? reasonMap[data.reasonType] ?? null : null
      toast.error(reasonText ? `自动换源失败：${data.trackTitle}（${reasonText}）` : `自动换源失败：${data.trackTitle}`, { id })
    }

    const onError = (error: { code: string; message: string }) => {
      // WRONG_PASSWORD is handled by RoomPage's own UI (gate password field),
      // so skip the generic toast to avoid duplicate feedback.
      if (error.code === ERROR_CODE.WRONG_PASSWORD) return

      toast.error(error.message)
      if (error.code === ERROR_CODE.ROOM_NOT_FOUND) {
        navigateRef.current('/', { replace: true })
      }
    }

    socket.on(EVENTS.ROOM_STATE, onRoomState)
    socket.on(EVENTS.ROOM_REJOIN_TOKEN, onRejoinToken)
    socket.on(EVENTS.ROOM_USER_JOINED, onUserJoined)
    socket.on(EVENTS.ROOM_USER_LEFT, onUserLeft)
    socket.on(EVENTS.ROOM_SETTINGS, onSettings)
    socket.on(EVENTS.ROOM_ROLE_CHANGED, onRoleChanged)
    socket.on(EVENTS.ROOM_AUTO_FALLBACK, onAutoFallback)
    socket.on(EVENTS.ROOM_ERROR, onError)

    // If room was already set before this hook mounted (e.g. HomePage consumed
    // ROOM_STATE and navigated here), resend cookies now. The ref guard prevents
    // React Strict Mode's double-mount from sending twice.
    if (!mountResendDone.current && useRoomStore.getState().room) {
      mountResendDone.current = true
      resendCookies()
    }

    return () => {
      socket.off(EVENTS.ROOM_STATE, onRoomState)
      socket.off(EVENTS.ROOM_REJOIN_TOKEN, onRejoinToken)
      socket.off(EVENTS.ROOM_USER_JOINED, onUserJoined)
      socket.off(EVENTS.ROOM_USER_LEFT, onUserLeft)
      socket.off(EVENTS.ROOM_SETTINGS, onSettings)
      socket.off(EVENTS.ROOM_ROLE_CHANGED, onRoleChanged)
      socket.off(EVENTS.ROOM_AUTO_FALLBACK, onAutoFallback)
      socket.off(EVENTS.ROOM_ERROR, onError)
    }
  }, [socket])
}
