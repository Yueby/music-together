import { getSocket, type TypedSocket } from '@/lib/socket'
import { SERVER_URL } from '@/lib/config'
import { storage } from '@/lib/storage'
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { EVENTS, type ServerRestartingEvent } from '@music-together/shared'
import { reportServerVersion } from '@/stores/versionStore'

interface SocketContextValue {
  socket: TypedSocket
  isConnected: boolean
  requiresManualJoin: boolean
}

const SocketContext = createContext<SocketContextValue | null>(null)

export interface SocketStateProviderProps {
  socket: TypedSocket
  isConnected: boolean
  requiresManualJoin?: boolean
  children: ReactNode
}

export function SocketStateProvider({
  socket,
  isConnected,
  requiresManualJoin = false,
  children,
}: SocketStateProviderProps) {
  const value = useMemo<SocketContextValue>(
    () => ({ socket, isConnected, requiresManualJoin }),
    [socket, isConnected, requiresManualJoin],
  )
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}

/** Persistent toast id so we can dismiss it on reconnect */
const DISCONNECT_TOAST_ID = 'socket-disconnect'
const OVERLOAD_TOAST_ID = 'server-overloaded'
const OVERLOAD_RETRY_MS = 5_000
const RESTART_TOAST_ID = 'server-restarting'
const BOOTSTRAP_TOAST_ID = 'identity-bootstrap'

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<TypedSocket>(getSocket())
  const hasDisconnectedRef = useRef(false)
  const [isConnected, setIsConnected] = useState(socketRef.current.connected)

  useEffect(() => {
    const socket = socketRef.current
    let cancelled = false
    const bootstrapController = new AbortController()
    let bootstrapped = false
    let bootstrapping = false
    let bootstrapRetryMs = 1_000
    let bootstrapRetryTimer: ReturnType<typeof setTimeout> | undefined
    let reauthenticating = false
    let overloadRetryTimer: ReturnType<typeof setTimeout> | undefined
    let restartRetryTimer: ReturnType<typeof setTimeout> | undefined
    let restartRetryAfter: number | undefined

    const onConnect = () => {
      clearTimeout(overloadRetryTimer)
      clearTimeout(restartRetryTimer)
      restartRetryAfter = undefined
      overloadRetryTimer = undefined
      toast.dismiss(OVERLOAD_TOAST_ID)
      toast.dismiss(RESTART_TOAST_ID)
      setIsConnected(true)
      toast.dismiss(DISCONNECT_TOAST_ID)
      if (hasDisconnectedRef.current) {
        toast.success('已重新连接', { id: 'socket-reconnect' })
      }
    }

    const onDisconnect = (reason: string) => {
      setIsConnected(false)
      hasDisconnectedRef.current = true
      if (reason === 'io server disconnect') {
        clearTimeout(restartRetryTimer)
        restartRetryTimer = setTimeout(() => {
          if (!cancelled && !socket.connected && !socket.active) socket.connect()
        }, restartRetryAfter ?? 500)
      }
      if (restartRetryAfter !== undefined) return
      toast.warning('连接已断开，正在重连…', {
        id: DISCONNECT_TOAST_ID,
        duration: Infinity,
      })
    }

    const onRestarting = ({ retryAfterMs }: ServerRestartingEvent) => {
      restartRetryAfter = Math.max(0, Math.min(retryAfterMs, 3000))
      toast.info('服务正在更新，即将自动重连…', { id: RESTART_TOAST_ID })
    }

    const bootstrapIdentity = async (): Promise<boolean> => {
      try {
        const res = await fetch(`${SERVER_URL}/api/auth/identity/bootstrap`, {
          method: 'POST',
          credentials: 'include',
          signal: bootstrapController.signal,
        })
        if (cancelled) return false
        if (!res.ok) {
          storage.clearUserId()
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
        if (!cancelled) storage.clearUserId()
        return false
      }
    }

    const ensureIdentityAndConnect = async (): Promise<void> => {
      if (cancelled || bootstrapped || bootstrapping) return
      clearTimeout(bootstrapRetryTimer)
      bootstrapping = true
      const ok = await bootstrapIdentity()
      bootstrapping = false
      if (cancelled) return
      if (ok) {
        bootstrapped = true
        toast.dismiss(BOOTSTRAP_TOAST_ID)
        if (!socket.connected) socket.connect()
        return
      }
      if (bootstrapRetryMs === 1_000) {
        toast.error('身份初始化失败，正在重试…', { id: BOOTSTRAP_TOAST_ID })
      }
      bootstrapRetryTimer = setTimeout(ensureIdentityAndConnect, bootstrapRetryMs)
      bootstrapRetryMs = Math.min(bootstrapRetryMs * 2, 30_000)
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') void ensureIdentityAndConnect()
    }

    const onConnectError = async (err: Error) => {
      if (cancelled) return
      if (err.message === 'SERVER_OVERLOADED') {
        if (overloadRetryTimer !== undefined) return
        toast.dismiss(DISCONNECT_TOAST_ID)
        toast.warning('服务器当前较繁忙，正在重试…', { id: OVERLOAD_TOAST_ID, duration: Infinity })
        overloadRetryTimer = setTimeout(() => {
          overloadRetryTimer = undefined
          if (!cancelled && !socket.connected) socket.connect()
        }, OVERLOAD_RETRY_MS)
        return
      }
      if (err.message !== 'UNAUTHENTICATED') return
      if (reauthenticating) return

      reauthenticating = true
      try {
        const ok = await bootstrapIdentity()
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
    socket.on(EVENTS.SERVER_HELLO, reportServerVersion)
    socket.on(EVENTS.SERVER_RESTARTING, onRestarting)
    window.addEventListener('online', ensureIdentityAndConnect)
    document.addEventListener('visibilitychange', onVisible)
    void ensureIdentityAndConnect()

    return () => {
      cancelled = true
      bootstrapController.abort()
      clearTimeout(bootstrapRetryTimer)
      clearTimeout(overloadRetryTimer)
      clearTimeout(restartRetryTimer)
      toast.dismiss(BOOTSTRAP_TOAST_ID)
      toast.dismiss(OVERLOAD_TOAST_ID)
      window.removeEventListener('online', ensureIdentityAndConnect)
      document.removeEventListener('visibilitychange', onVisible)
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
      socket.off(EVENTS.SERVER_HELLO, reportServerVersion)
      socket.off(EVENTS.SERVER_RESTARTING, onRestarting)
    }
  }, [])

  return (
    <SocketStateProvider socket={socketRef.current} isConnected={isConnected}>
      {children}
    </SocketStateProvider>
  )
}

export function useSocketContext(): SocketContextValue {
  const ctx = useContext(SocketContext)
  if (!ctx) throw new Error('useSocketContext must be used within SocketProvider')
  return ctx
}
