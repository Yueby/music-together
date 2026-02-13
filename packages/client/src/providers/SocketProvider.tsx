import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { connectSocket, type TypedSocket } from '@/lib/socket'
import { toast } from 'sonner'
import { useClockSync } from '@/hooks/useClockSync'

interface SocketContextValue {
  socket: TypedSocket
  isConnected: boolean
}

const SocketContext = createContext<SocketContextValue | null>(null)

/** Persistent toast id so we can dismiss it on reconnect */
const DISCONNECT_TOAST_ID = 'socket-disconnect'

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<TypedSocket>(connectSocket())
  const [isConnected, setIsConnected] = useState(socketRef.current.connected)

  useEffect(() => {
    const socket = socketRef.current

    const onConnect = () => {
      setIsConnected(true)
      toast.dismiss(DISCONNECT_TOAST_ID)
      // Only show reconnect toast if we've been disconnected before
      if (hasDisconnected.current) {
        toast.success('已重新连接')
      }
    }

    const onDisconnect = () => {
      setIsConnected(false)
      hasDisconnected.current = true
      toast.warning('连接已断开，正在重连…', {
        id: DISCONNECT_TOAST_ID,
        duration: Infinity,
      })
    }

    const hasDisconnected = { current: false }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)

    // Ensure connected
    if (!socket.connected) {
      socket.connect()
    }

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
    }
  }, [])

  const value = useMemo<SocketContextValue>(
    () => ({ socket: socketRef.current, isConnected }),
    [isConnected],
  )

  return (
    <SocketContext.Provider value={value}>
      <ClockSyncRunner />
      {children}
    </SocketContext.Provider>
  )
}

/** Invisible component that runs the NTP clock-sync loop. */
function ClockSyncRunner() {
  useClockSync()
  return null
}

export function useSocketContext(): SocketContextValue {
  const ctx = useContext(SocketContext)
  if (!ctx) throw new Error('useSocketContext must be used within SocketProvider')
  return ctx
}
