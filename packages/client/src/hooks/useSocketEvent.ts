import type { ServerToClientEvents } from '@music-together/shared'
import { useSocketContext } from '@/providers/SocketProvider'
import { useEffect, useRef } from 'react'

/**
 * Generic hook to subscribe to a typed Socket.IO event.
 * Automatically handles on/off lifecycle and keeps the handler reference stable.
 *
 * @example
 * useSocketEvent(EVENTS.ROOM_STATE, useCallback((room) => { ... }, []))
 */
export function useSocketEvent<E extends keyof ServerToClientEvents>(
  event: E,
  handler: ServerToClientEvents[E],
) {
  const { socket } = useSocketContext()

  // Keep a stable ref so the effect doesn't re-subscribe on every render
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    // Wrapper delegates to the latest handler via ref
    const wrapper = ((...args: unknown[]) => {
      ;(handlerRef.current as (...a: unknown[]) => void)(...args)
    }) as ServerToClientEvents[E]

    socket.on(event, wrapper as any)
    return () => {
      socket.off(event, wrapper as any)
    }
  }, [socket, event])
}
