import { storage } from '@/lib/storage'
import { useSocketContext } from '@/providers/SocketProvider'
import { useRoomStore } from '@/stores/roomStore'
import type { MusicSource, MyPlatformAuth, PlatformAuthStatus } from '@music-together/shared'
import { EVENTS } from '@music-together/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

/**
 * Hook for managing platform authentication state.
 * Listens to auth events from the server and provides methods
 * for QR login, manual cookie, and logout.
 *
 * Cookie persistence + auto-resend is handled by `storage.ts` and `useRoom.ts`.
 * This hook only manages UI state and user-initiated actions.
 */
export function useAuth() {
  const { socket } = useSocketContext()
  const [platformStatus, setPlatformStatus] = useState<PlatformAuthStatus[]>([])
  const [myStatus, setMyStatus] = useState<MyPlatformAuth[]>([])
  const [statusLoaded, setStatusLoaded] = useState(false)
  const [qrData, setQrData] = useState<{ key: string; qrimg: string } | null>(null)
  const [qrStatus, setQrStatus] = useState<{ status: number; message: string } | null>(null)
  const [isQrLoading, setIsQrLoading] = useState(false)
  const [qrPlatform, setQrPlatform] = useState<MusicSource>('netease')

  // Ref mirrors qrPlatform so checkQrStatus always reads the latest value
  // without re-creating the callback (which would restart the polling interval).
  const qrPlatformRef = useRef<MusicSource>(qrPlatform)

  // Track how many auto-resend results are still pending so we can suppress their toasts.
  const pendingAutoResendRef = useRef(0)

  useEffect(() => {
    const onStatusUpdate = (data: PlatformAuthStatus[]) => {
      setPlatformStatus(data)
    }

    const onMyStatus = (data: MyPlatformAuth[]) => {
      setMyStatus(data)
      setStatusLoaded(true)
    }

    const onQrGenerated = (data: { key: string; qrimg: string }) => {
      setQrData(data)
      setQrStatus({ status: 801, message: '等待扫码' })
      setIsQrLoading(false)
    }

    const onQrStatus = (data: { status: number; message: string }) => {
      setQrStatus(data)
      // On success or expiry, clear loading
      if (data.status === 803 || data.status === 800) {
        setIsQrLoading(false)
      }
    }

    // localStorage persistence is handled by useRoom.ts (always-mounted).
    // Here we only handle toast display for user-initiated actions.
    // For auto-resend: suppress SUCCESS toasts (avoid noisy "已登录为 xxx" on room join),
    // but let FAILURE toasts through — useAuthSync handles those with proper feedback.
    const onCookieResult = (data: {
      success: boolean
      message: string
      platform?: MusicSource
      cookie?: string
      reason?: 'expired' | 'error'
    }) => {
      if (pendingAutoResendRef.current > 0) {
        pendingAutoResendRef.current--
        if (data.success) {
          return // Suppress success toast for auto-resend
        }
        // Failure toasts are NOT suppressed — useAuthSync shows them
        return
      }
      if (data.success) {
        toast.success(data.message)
      } else {
        toast.error(data.message)
      }
    }

    // When we receive ROOM_STATE, useRoom.ts handles auto-resend.
    // We listen to track how many auto-resend results are expected so we can mute toasts.
    const onRoomState = () => {
      const stored = storage.getAuthCookies()
      pendingAutoResendRef.current = stored.length
    }

    socket.on(EVENTS.AUTH_STATUS_UPDATE, onStatusUpdate)
    socket.on(EVENTS.AUTH_MY_STATUS, onMyStatus)
    socket.on(EVENTS.AUTH_QR_GENERATED, onQrGenerated)
    socket.on(EVENTS.AUTH_QR_STATUS, onQrStatus)
    socket.on(EVENTS.AUTH_SET_COOKIE_RESULT, onCookieResult)
    socket.on(EVENTS.ROOM_STATE, onRoomState)

    // Fetch current status on mount (covers late-mount scenario)
    socket.emit(EVENTS.AUTH_GET_STATUS)

    // If room was already set before this hook mounted (e.g. HomePage consumed
    // ROOM_STATE and navigated here), set the pending count now so auto-resend
    // success toasts from useRoomState's mount-based resend are suppressed.
    if (useRoomStore.getState().room) {
      const stored = storage.getAuthCookies()
      pendingAutoResendRef.current = stored.length
    }

    return () => {
      socket.off(EVENTS.AUTH_STATUS_UPDATE, onStatusUpdate)
      socket.off(EVENTS.AUTH_MY_STATUS, onMyStatus)
      socket.off(EVENTS.AUTH_QR_GENERATED, onQrGenerated)
      socket.off(EVENTS.AUTH_QR_STATUS, onQrStatus)
      socket.off(EVENTS.AUTH_SET_COOKIE_RESULT, onCookieResult)
      socket.off(EVENTS.ROOM_STATE, onRoomState)
    }
  }, [socket])

  const requestQrCode = useCallback(
    (platform: MusicSource) => {
      setQrData(null)
      setQrStatus(null)
      setIsQrLoading(true)
      setQrPlatform(platform)
      qrPlatformRef.current = platform
      socket.emit(EVENTS.AUTH_REQUEST_QR, { platform })
    },
    [socket],
  )

  const checkQrStatus = useCallback(
    (key: string) => {
      socket.emit(EVENTS.AUTH_CHECK_QR, { key, platform: qrPlatformRef.current })
    },
    [socket],
  )

  const setCookie = useCallback(
    (platform: MusicSource, cookie: string) => {
      socket.emit(EVENTS.AUTH_SET_COOKIE, { platform, cookie })
    },
    [socket],
  )

  const logout = useCallback(
    (platform: MusicSource) => {
      // Remove from localStorage immediately
      storage.removeAuthCookie(platform)
      socket.emit(EVENTS.AUTH_LOGOUT, { platform })
    },
    [socket],
  )

  const resetQr = useCallback(() => {
    setQrData(null)
    setQrStatus(null)
    setIsQrLoading(false)
  }, [])

  return {
    platformStatus,
    myStatus,
    statusLoaded,
    qrData,
    qrStatus,
    qrPlatform,
    isQrLoading,
    requestQrCode,
    checkQrStatus,
    setCookie,
    logout,
    resetQr,
  }
}
