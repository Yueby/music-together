import { useSocketContext } from '@/providers/SocketProvider'
import { storage } from '@/lib/storage'
import { EVENTS } from '@music-together/shared'
import type { MusicSource } from '@music-together/shared'
import { useEffect } from 'react'
import { toast } from 'sonner'

const PLATFORM_NAMES: Record<MusicSource, string> = {
  netease: '网易云音乐',
  tencent: 'QQ 音乐',
  kugou: '酷狗音乐',
}

/**
 * Handles AUTH_SET_COOKIE_RESULT in the always-mounted room lifecycle,
 * so that localStorage is updated even when the settings dialog is closed.
 *
 * IMPORTANT: This hook NEVER removes cookies from localStorage.
 * The only place that deletes a cookie is `useAuth.logout()` (user-initiated).
 * On validation failure (expired or transient error), the cookie is preserved
 * so it can be retried on next room join.
 */
export function useAuthSync() {
  const { socket } = useSocketContext()

  useEffect(() => {
    const onAuthCookieResult = (data: {
      success: boolean
      message: string
      platform?: MusicSource
      cookie?: string
      reason?: 'expired' | 'error'
    }) => {
      if (data.success) {
        if (data.platform && data.cookie) {
          storage.upsertAuthCookie(data.platform, data.cookie)
        }
      } else if (data.platform) {
        const name = PLATFORM_NAMES[data.platform] ?? data.platform

        if (data.reason === 'expired') {
          toast.warning(`${name} 登录验证失败，将在下次进入房间时重试`, { id: `auth-expired-${data.platform}` })
        } else if (data.reason === 'error') {
          toast.info(`${name} 登录验证失败，将在下次进入房间时重试`, { id: `auth-error-${data.platform}` })
        }
        // Cookie is NEVER removed here — only useAuth.logout() can do that.
      }
    }

    socket.on(EVENTS.AUTH_SET_COOKIE_RESULT, onAuthCookieResult)

    return () => {
      socket.off(EVENTS.AUTH_SET_COOKIE_RESULT, onAuthCookieResult)
    }
  }, [socket])
}
