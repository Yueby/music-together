import { useSocketContext } from '@/providers/SocketProvider'
import { storage } from '@/lib/storage'
import { EVENTS } from '@music-together/shared'
import type { MusicSource } from '@music-together/shared'
import { useEffect } from 'react'

/**
 * Handles AUTH_SET_COOKIE_RESULT in the always-mounted room lifecycle,
 * so that localStorage is updated even when the settings dialog is closed.
 */
export function useAuthSync() {
  const { socket } = useSocketContext()

  useEffect(() => {
    const onAuthCookieResult = (data: {
      success: boolean
      message: string
      platform?: MusicSource
      cookie?: string
    }) => {
      if (data.success) {
        if (data.platform && data.cookie) {
          storage.upsertAuthCookie(data.platform, data.cookie)
        }
      } else {
        // Expired/invalid cookie — remove from localStorage
        if (data.platform) {
          storage.removeAuthCookie(data.platform)
        }
      }
    }

    socket.on(EVENTS.AUTH_SET_COOKIE_RESULT, onAuthCookieResult)

    return () => {
      socket.off(EVENTS.AUTH_SET_COOKIE_RESULT, onAuthCookieResult)
    }
  }, [socket])
}
