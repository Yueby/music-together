import { connectSocket, getSocket } from '@/lib/socket'
import { useRoomStore } from '@/stores/roomStore'
import { useEffect } from 'react'

export function useSocket() {
  const setConnected = useRoomStore((s) => s.setConnected)

  useEffect(() => {
    const socket = connectSocket()

    // Sync initial state (socket may already be connected from HomePage)
    if (socket.connected) {
      setConnected(true)
    }

    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)

    return () => {
      // Only remove OUR listeners — do NOT destroy the socket singleton.
      // Destroying it under StrictMode causes a new socket with a different id,
      // while all hooks still hold the old (dead) reference from render time.
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
    }
  }, [setConnected])

  return getSocket()
}
