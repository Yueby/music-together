import { getSocket, type TypedSocket } from '@/lib/socket'
import { SERVER_URL } from '@/lib/config'
import { storage } from '@/lib/storage'
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

interface SocketContextValue {
  socket: TypedSocket
  isConnected: boolean
}

const SocketContext = createContext<SocketContextValue | null>(null)

/** Persistent toast id so we can dismiss it on reconnect */
const DISCONNECT_TOAST_ID = 'socket-disconnect'

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<TypedSocket>(getSocket())
  const hasDisconnectedRef = useRef(false)
  const [isConnected, setIsConnected] = useState(socketRef.current.connected)

  useEffect(() => {
    const socket = socketRef.current
    let cancelled = false
    let reauthenticating = false

    const onConnect = () => {
      setIsConnected(true)
      toast.dismiss(DISCONNECT_TOAST_ID)
      if (hasDisconnectedRef.current) {
        toast.success('已重新连接', { id: 'socket-reconnect' })
      }
    }

    const onDisconnect = () => {
      setIsConnected(false)
      hasDisconnectedRef.current = true
      toast.warning('连接已断开，正在重连…', {
        id: DISCONNECT_TOAST_ID,
        duration: Infinity,
      })
    }

    const bootstrapIdentity = async (showError = true): Promise<boolean> => {
      try {
        const res = await fetch(`${SERVER_URL}/api/auth/identity/bootstrap`, {
          method: 'POST',
          credentials: 'include',
        })
        if (!res.ok) {
          storage.clearUserId()
          if (showError) toast.error('身份初始化失败，请刷新重试')
          return false
        }

        const userId = res.headers.get('X-Identity-UserId') ?? res.headers.get('x-identity-userid')
        if (userId && userId.trim().length > 0) {
          storage.setUserId(userId.trim())
        } else {
          storage.clearUserId()
        }
        return true
      } catch {
        storage.clearUserId()
        if (showError) toast.error('连接服务器失败，请稍后重试')
        return false
      }
    }

    const ensureIdentityAndConnect = async (showError = true): Promise<void> => {
      await bootstrapIdentity(showError)
      if (!cancelled && !socket.connected) {
        socket.connect()
      }
    }

    const onConnectError = async (err: Error) => {
      if (err.message !== 'UNAUTHENTICATED') return
      if (cancelled || reauthenticating) return

      reauthenticating = true
      try {
        const ok = await bootstrapIdentity(false)
        if (ok && !cancelled && !socket.connected) {
          socket.connect()
        }
      } finally {
        reauthenticating = false
      }
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)
    ensureIdentityAndConnect()

    return () => {
      cancelled = true
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
    }
  }, [])

  const value = useMemo<SocketContextValue>(() => ({ socket: socketRef.current, isConnected }), [isConnected])

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}

export function useSocketContext(): SocketContextValue {
  const ctx = useContext(SocketContext)
  if (!ctx) throw new Error('useSocketContext must be used within SocketProvider')
  return ctx
}
