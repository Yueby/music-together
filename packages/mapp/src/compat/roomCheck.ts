import '../cspValidation.ts'
import { EVENTS } from '@music-together/shared'
import type { RoomCheckInfo, RoomCheckReader } from '../../../client/src/lib/RoomCheckReader.ts'
import type { MappRoomSession } from './RoomSession.ts'

const TIMEOUT_MS = 5000
const cancelled = () => new DOMException('ROOM_CHECK_CANCELLED', 'AbortError')

/** Reads the existing authoritative public list without owning the session or connection. */
export function createMappRoomCheck(
  session: Pick<MappRoomSession, 'socket' | 'snapshot' | 'subscribe'>,
  lifetimeSignal?: AbortSignal,
): RoomCheckReader {
  return (socket, roomId, options) => {
    if (socket !== session.socket) return Promise.reject(new Error('ROOM_CHECK_SOCKET_MISMATCH'))
    const signal = options?.signal
    if (signal?.aborted || lifetimeSignal?.aborted || session.snapshot.status === 'disposed') {
      return Promise.reject(cancelled())
    }

    return new Promise<RoomCheckInfo | null>((resolve, reject) => {
      let sent = false
      let settled = false
      let unsubscribe: (() => void) | undefined

      const finish = (outcome: { info: RoomCheckInfo | null } | { error: Error }) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        socket.off(EVENTS.ROOM_LIST_UPDATE, onList)
        socket.off('disconnect', onDisconnect)
        signal?.removeEventListener('abort', onAbort)
        lifetimeSignal?.removeEventListener('abort', onAbort)
        unsubscribe?.()
        if ('error' in outcome) reject(outcome.error)
        else resolve(outcome.info)
      }
      const fail = (code: string) => finish({ error: new Error(code) })
      const onAbort = () => finish({ error: cancelled() })
      const onDisconnect = () => {
        if (sent) fail('ROOM_CHECK_DISCONNECTED')
      }
      const onList = (rooms: Parameters<Parameters<typeof socket.on<typeof EVENTS.ROOM_LIST_UPDATE>>[1]>[0]) => {
        if (!sent) return
        const room = rooms.find((item) => item.id === roomId)
        finish({ info: room ? { name: room.name, hasPassword: room.hasPassword, userCount: room.userCount } : null })
      }
      // Waits for identity, then asks for the public list exactly once.
      const onSession = () => {
        if (settled) return
        const { status, connected, userId } = session.snapshot
        if (status === 'disposed') return onAbort()
        if (sent) {
          if (!connected || !socket.connected) onDisconnect()
          return
        }
        if (!connected || !userId || !socket.connected) return
        // Mark sent before emitting: fixtures (and fast servers) may reply synchronously.
        sent = true
        try {
          socket.emit(EVENTS.ROOM_LIST)
        } catch {
          fail('ROOM_CHECK_REQUEST_FAILED')
        }
      }

      const timer = setTimeout(() => fail('ROOM_CHECK_TIMEOUT'), TIMEOUT_MS)
      socket.on(EVENTS.ROOM_LIST_UPDATE, onList)
      socket.on('disconnect', onDisconnect)
      signal?.addEventListener('abort', onAbort, { once: true })
      lifetimeSignal?.addEventListener('abort', onAbort, { once: true })
      // subscribe can invoke onSession (and even settle this request) before it returns.
      const stop = session.subscribe(onSession)
      if (settled) stop()
      else unsubscribe = stop
      onSession()
    })
  }
}
