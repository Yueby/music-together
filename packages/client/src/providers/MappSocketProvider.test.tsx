// @vitest-environment jsdom
import { act, StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MappSocketProvider, type MappSessionLike, type MappSessionSnapshot } from './MappSocketProvider'
import { useSocketContext } from './SocketProvider'
import type { TypedSocket } from '@/lib/socket'

const getSocketMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('Tripwire: getSocket must never be called by MappSocketProvider')
  }),
)

vi.mock('@/lib/socket', () => ({
  getSocket: getSocketMock,
}))

function createFakeSession(initialSnapshot: MappSessionSnapshot = { connected: false, userId: null }) {
  let currentSnapshot: MappSessionSnapshot = Object.freeze({ ...initialSnapshot })
  const listeners = new Set<() => void>()
  const fakeSocket = {
    id: `fake-socket-${Math.random().toString(36).slice(2, 7)}`,
    connected: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as TypedSocket

  const session = {
    socket: fakeSocket,
    get snapshot() {
      return currentSnapshot
    },
    subscribe: vi.fn((listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }),
    connect: vi.fn(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
    listenerCount: () => listeners.size,
    setSnapshot(next: MappSessionSnapshot) {
      currentSnapshot = Object.freeze({ ...next })
      listeners.forEach((listener) => listener())
    },
  }

  return session
}

describe('MappSocketProvider', () => {
  let container: HTMLDivElement | null = null
  let root: ReturnType<typeof createRoot> | null = null

  beforeEach(() => {
    vi.restoreAllMocks()
    const tripwireFetch = vi.fn(() => {
      throw new Error('Tripwire: fetch must never be called by MappSocketProvider')
    })
    vi.stubGlobal('fetch', tripwireFetch)

    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root!.unmount()
      })
      root = null
    }
    if (container) {
      container.remove()
      container = null
    }
    vi.unstubAllGlobals()
  })

  it('renders without calling getSocket or fetch, passes original socket reference, and reflects connection updates', async () => {
    const session = createFakeSession({ connected: false, userId: null })
    let capturedContext: ReturnType<typeof useSocketContext> | null = null

    function Consumer() {
      capturedContext = useSocketContext()
      return null
    }

    await act(async () => {
      root!.render(
        <MappSocketProvider session={session}>
          <Consumer />
        </MappSocketProvider>,
      )
    })

    expect(getSocketMock).not.toHaveBeenCalled()
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(capturedContext).not.toBeNull()
    expect(capturedContext!.socket).toBe(session.socket)
    // Initial state: connected: false, userId: null -> isConnected false
    expect(capturedContext!.isConnected).toBe(false)

    // Identity not ready: socket says connected, but userId is still null -> isConnected false
    await act(async () => {
      session.setSnapshot({ connected: true, userId: null })
    })
    expect(capturedContext!.isConnected).toBe(false)

    await act(async () => session.setSnapshot({ connected: true, userId: '' }))
    expect(capturedContext!.isConnected).toBe(false)

    // Identity confirmed: connected true and userId present -> isConnected true
    await act(async () => {
      session.setSnapshot({ connected: true, userId: 'user-mapp-1' })
    })
    expect(capturedContext!.isConnected).toBe(true)

    // Disconnected: connected false -> isConnected false
    await act(async () => {
      session.setSnapshot({ connected: false, userId: 'user-mapp-1' })
    })
    expect(capturedContext!.isConnected).toBe(false)
  })

  it.each(['REJOIN_FAILED', 'REJOIN_TOKEN_MISSING', 'REJOIN_TOKEN_EXPIRED', 'IDENTITY_CHANGED'])(
    'projects %s as an explicit manual-entry requirement',
    async (errorCode) => {
      const session = createFakeSession({ connected: true, userId: 'confirmed-user' })
      let captured: ReturnType<typeof useSocketContext> | null = null
      function Consumer() {
        captured = useSocketContext()
        return null
      }
      await act(async () =>
        root!.render(
          <MappSocketProvider session={session}>
            <Consumer />
          </MappSocketProvider>,
        ),
      )
      expect(captured!.requiresManualJoin).toBe(false)
      await act(async () => session.setSnapshot({ connected: true, userId: 'confirmed-user', errorCode }))
      expect(captured!.isConnected).toBe(true)
      expect(captured!.requiresManualJoin).toBe(true)
      await act(async () => session.setSnapshot({ connected: true, userId: 'confirmed-user', errorCode: null }))
      expect(captured!.requiresManualJoin).toBe(false)
    },
  )

  it('preserves cached snapshot reference across reads without synthesizing new objects', () => {
    const session = createFakeSession({ connected: true, userId: 'cached-user' })
    const snap1 = session.snapshot
    const snap2 = session.snapshot
    expect(snap1).toBe(snap2)
  })

  it('switches sessions cleanly: un-subscribes from old session and subscribes to new session', async () => {
    const sessionA = createFakeSession({ connected: true, userId: 'user-a' })
    const sessionB = createFakeSession({ connected: true, userId: 'user-b' })

    let setSessionFn!: (s: MappSessionLike) => void
    let capturedContext: ReturnType<typeof useSocketContext> | null = null

    function Consumer() {
      capturedContext = useSocketContext()
      return null
    }

    function Wrapper() {
      const [currentSession, setCurrentSession] = useState<MappSessionLike>(sessionA)
      setSessionFn = setCurrentSession
      return (
        <MappSocketProvider session={currentSession}>
          <Consumer />
        </MappSocketProvider>
      )
    }

    await act(async () => {
      root!.render(<Wrapper />)
    })

    expect(sessionA.subscribe).toHaveBeenCalledTimes(1)
    expect(sessionA.listenerCount()).toBe(1)
    expect(capturedContext!.socket).toBe(sessionA.socket)

    // Switch to sessionB
    await act(async () => {
      setSessionFn(sessionB)
    })

    expect(sessionA.listenerCount()).toBe(0)
    expect(sessionB.subscribe).toHaveBeenCalledTimes(1)
    expect(sessionB.listenerCount()).toBe(1)
    expect(capturedContext!.socket).toBe(sessionB.socket)
  })

  it('does not call disconnect, dispose, or touch storage on StrictMode unmount', async () => {
    const session = createFakeSession({ connected: true, userId: 'strict-user' })
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem')
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem')

    function Consumer() {
      useSocketContext()
      return null
    }

    await act(async () => {
      root!.render(
        <StrictMode>
          <MappSocketProvider session={session}>
            <Consumer />
          </MappSocketProvider>
        </StrictMode>,
      )
    })

    expect(session.subscribe).toHaveBeenCalled()

    await act(async () => {
      root!.unmount()
      root = null
    })

    expect(session.connect).not.toHaveBeenCalled()
    expect(session.disconnect).not.toHaveBeenCalled()
    expect(session.socket.connect).not.toHaveBeenCalled()
    expect(session.socket.disconnect).not.toHaveBeenCalled()
    expect(session.dispose).not.toHaveBeenCalled()
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(setItemSpy).not.toHaveBeenCalled()
    expect(getItemSpy).not.toHaveBeenCalled()
    expect(removeItemSpy).not.toHaveBeenCalled()
    expect(session.listenerCount()).toBe(0)
  })
})
