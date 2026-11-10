import type { TypedSocket } from '@/lib/socket'
import { useCallback, useSyncExternalStore, type ReactNode } from 'react'
import { SocketStateProvider } from './SocketProvider'

export interface MappSessionSnapshot {
  readonly connected: boolean
  readonly userId: string | null
  readonly errorCode?: string | null
}

export interface MappSessionLike {
  readonly socket: TypedSocket
  readonly snapshot: MappSessionSnapshot
  subscribe(listener: () => void): () => void
}

export interface MappSocketProviderProps {
  session: MappSessionLike
  children: ReactNode
}

/** Failed automatic re-entry: the shared RoomPage must wait for a fresh user interaction. */
const MANUAL_JOIN_ERRORS = new Set(['REJOIN_FAILED', 'REJOIN_TOKEN_MISSING', 'REJOIN_TOKEN_EXPIRED', 'IDENTITY_CHANGED'])

export function MappSocketProvider({ session, children }: MappSocketProviderProps) {
  const subscribe = useCallback((listener: () => void) => session.subscribe(listener), [session])
  const getSnapshot = useCallback(() => session.snapshot, [session])
  const snapshot = useSyncExternalStore(subscribe, getSnapshot)

  // Connected means a transport plus a server-confirmed identity.
  const isConnected = snapshot.connected && Boolean(snapshot.userId)
  const requiresManualJoin = MANUAL_JOIN_ERRORS.has(snapshot.errorCode ?? '')

  return (
    <SocketStateProvider socket={session.socket} isConnected={isConnected} requiresManualJoin={requiresManualJoin}>
      {children}
    </SocketStateProvider>
  )
}
