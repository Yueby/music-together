import { storage } from '@/lib/storage'
import { useSocketContext } from '@/providers/SocketProvider'
import type { MusicSource, MyPlatformAuth, PlatformAuthStatus } from '@music-together/shared'
import { EVENTS } from '@music-together/shared'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Hook：管理平台认证 UI 状态
 *
 * 职责：
 * - QR 扫码登录状态（二维码数据、扫码状态、加载状态）
 * - 平台认证状态（聚合状态、个人状态）
 * - 用户操作方法（requestQrCode、setCookie、logout）
 *
 * 不负责：
 * - Cookie 持久化（由 useAuthSync 处理）
 * - Cookie 验证结果 toast（由 useAuthSync 处理）
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

  // Ref 跟踪最新的 qrPlatform，避免重建回调导致重启轮询
  const qrPlatformRef = useRef<MusicSource>(qrPlatform)

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
      if (data.status === 803 || data.status === 800) {
        setIsQrLoading(false)
      }
    }

    socket.on(EVENTS.AUTH_STATUS_UPDATE, onStatusUpdate)
    socket.on(EVENTS.AUTH_MY_STATUS, onMyStatus)
    socket.on(EVENTS.AUTH_QR_GENERATED, onQrGenerated)
    socket.on(EVENTS.AUTH_QR_STATUS, onQrStatus)

    // 挂载时拉取当前状态（覆盖延迟挂载场景）
    socket.emit(EVENTS.AUTH_GET_STATUS)

    return () => {
      socket.off(EVENTS.AUTH_STATUS_UPDATE, onStatusUpdate)
      socket.off(EVENTS.AUTH_MY_STATUS, onMyStatus)
      socket.off(EVENTS.AUTH_QR_GENERATED, onQrGenerated)
      socket.off(EVENTS.AUTH_QR_STATUS, onQrStatus)
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
