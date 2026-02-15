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
    // Wrapper delegates to the latest handler via ref.
    // Socket.IO's overloaded .on/.off signatures can't infer the handler type
    // from a generic event name, so we cast through `unknown` to satisfy the compiler.
    const wrapper: ServerToClientEvents[E] = ((...args: unknown[]) => {
      ;(handlerRef.current as (...a: unknown[]) => void)(...args)
    }) as unknown as ServerToClientEvents[E]

    socket.on(event as keyof ServerToClientEvents & string, wrapper as never)
    return () => {
      socket.off(event as keyof ServerToClientEvents & string, wrapper as never)
    }
  }, [socket, event])
}
