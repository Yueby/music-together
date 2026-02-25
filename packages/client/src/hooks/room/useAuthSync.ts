import { useSocketContext } from '@/providers/SocketProvider'
import { useRoomStore } from '@/stores/roomStore'
import { storage } from '@/lib/storage'
import { EVENTS } from '@music-together/shared'
import type { MusicSource } from '@music-together/shared'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

const PLATFORM_NAMES: Record<MusicSource, string> = {
  netease: '网易云音乐',
  tencent: 'QQ 音乐',
  kugou: '酷狗音乐',
}

/**
 * Hook：认证结果处理（always-mounted 级别）
 *
 * 统一处理 AUTH_SET_COOKIE_RESULT 事件：
 * 1. localStorage 持久化（成功时保存 cookie）
 * 2. Toast 通知（区分用户操作 vs 自动恢复）
 *
 * 设计决策：
 * - Cookie 只通过 useAuth.logout() 删除，本 hook 永不删除
 * - 自动恢复（auto-resend）成功时静默（避免进房间时 N 条 toast）
 * - 自动恢复失败时提示一次（用 toast id 去重）
 */
export function useAuthSync() {
  const { socket } = useSocketContext()

  // 跟踪待处理的自动恢复请求数，用于静默成功 toast
  const pendingAutoResendRef = useRef(0)

  useEffect(() => {
    const onAuthCookieResult = (data: {
      success: boolean
      message: string
      platform?: MusicSource
      cookie?: string
      reason?: 'expired' | 'error'
    }) => {
      if (data.success) {
        // 持久化 cookie
        if (data.platform && data.cookie) {
          storage.upsertAuthCookie(data.platform, data.cookie)
        }

        // 自动恢复成功时静默，手动操作时弹 toast
        if (pendingAutoResendRef.current > 0) {
          pendingAutoResendRef.current--
        } else {
          toast.success(data.message)
        }
      } else if (data.platform) {
        const name = PLATFORM_NAMES[data.platform] ?? data.platform

        // 自动恢复失败时消费计数
        if (pendingAutoResendRef.current > 0) {
          pendingAutoResendRef.current--
        }

        if (data.reason === 'expired') {
          toast.warning(`${name} 登录验证失败，将在下次进入房间时重试`, { id: `auth-expired-${data.platform}` })
        } else if (data.reason === 'error') {
          toast.info(`${name} 登录验证失败，将在下次进入房间时重试`, { id: `auth-error-${data.platform}` })
        } else {
          // 手动操作失败
          toast.error(data.message)
        }
        // Cookie 永不删除 — 只有 useAuth.logout() 有权删除
      }
    }

    // 当收到 ROOM_STATE 时，useRoomState 会自动恢复 cookie
    // 此处记录即将到来的恢复结果数量，以便静默成功 toast
    const onRoomState = () => {
      const stored = storage.getAuthCookies()
      pendingAutoResendRef.current = stored.length
    }

    socket.on(EVENTS.AUTH_SET_COOKIE_RESULT, onAuthCookieResult)
    socket.on(EVENTS.ROOM_STATE, onRoomState)

    // 如果组件挂载时已在房间中（如路由切换），也要初始化计数
    if (useRoomStore.getState().room) {
      const stored = storage.getAuthCookies()
      pendingAutoResendRef.current = stored.length
    }

    return () => {
      socket.off(EVENTS.AUTH_SET_COOKIE_RESULT, onAuthCookieResult)
      socket.off(EVENTS.ROOM_STATE, onRoomState)
    }
  }, [socket])
}
