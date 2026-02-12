import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { connectSocket, type TypedSocket } from '@/lib/socket'

interface SocketContextValue {
  socket: TypedSocket
  isConnected: boolean
}

const SocketContext = createContext<SocketContextValue | null>(null)

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<TypedSocket>(connectSocket())
  const [isConnected, setIsConnected] = useState(socketRef.current.connected)

  useEffect(() => {
    const socket = socketRef.current

    const onConnect = () => setIsConnected(true)
    const onDisconnect = () => setIsConnected(false)

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

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocketContext(): SocketContextValue {
  const ctx = useContext(SocketContext)
  if (!ctx) throw new Error('useSocketContext must be used within SocketProvider')
  return ctx
}
