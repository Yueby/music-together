// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SocketProvider, SocketStateProvider, useSocketContext } from './SocketProvider'
import type { TypedSocket } from '@/lib/socket'

const getSocketMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/socket', () => ({
  getSocket: getSocketMock,
}))

vi.mock('sonner', () => ({
  toast: {
    dismiss: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}))

function createMockSocket() {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>()
  return {
    connected: false,
    id: 'mock-socket-id',
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event)!.add(fn)
      return undefined as unknown as TypedSocket
    }),
    off: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
      listeners.get(event)?.delete(fn)
      return undefined as unknown as TypedSocket
    }),
    emitEvent(event: string, ...args: unknown[]) {
      listeners.get(event)?.forEach((fn) => fn(...args))
    },
    listenerCount(event: string) {
      return listeners.get(event)?.size ?? 0
    },
  }
}

describe('SocketProvider and SocketStateProvider', () => {
  let container: HTMLDivElement | null = null
  let root: ReturnType<typeof createRoot> | null = null

  beforeEach(() => {
    vi.restoreAllMocks()
    getSocketMock.mockReset()
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

  describe('SocketStateProvider (pure provider)', () => {
    it('provides original socket and isConnected without calling getSocket or fetch', async () => {
      getSocketMock.mockImplementation(() => {
        throw new Error('Tripwire: getSocket must not be called by SocketStateProvider')
      })
      const fetchMock = vi.fn(() => {
        throw new Error('Tripwire: fetch must not be called by SocketStateProvider')
      })
      vi.stubGlobal('fetch', fetchMock)

      const fakeSocket = { id: 'pure-socket' } as unknown as TypedSocket
      let capturedContext: ReturnType<typeof useSocketContext> | null = null

      function Consumer() {
        capturedContext = useSocketContext()
        return null
      }

      await act(async () => {
        root!.render(
          <SocketStateProvider socket={fakeSocket} isConnected={true}>
            <Consumer />
          </SocketStateProvider>,
        )
      })

      expect(getSocketMock).not.toHaveBeenCalled()
      expect(fetchMock).not.toHaveBeenCalled()
      expect(capturedContext).not.toBeNull()
      expect(capturedContext!.socket).toBe(fakeSocket)
      expect(capturedContext!.isConnected).toBe(true)
    })

    it('throws error when useSocketContext is called outside provider', () => {
      function Consumer() {
        useSocketContext()
        return null
      }

      expect(() => renderToString(<Consumer />)).toThrow('useSocketContext must be used within SocketProvider')
    })
  })

  describe('SocketProvider (Web regression)', () => {
    it('executes bootstrap POST with credentials include, connects on success, and unmounts 3 listeners', async () => {
      const mockSocket = createMockSocket()
      getSocketMock.mockReturnValue(mockSocket)

      const fetchMock = vi.fn(async () => ({
        ok: true,
        headers: new Headers({ 'X-Identity-UserId': 'user-web-1' }),
      }))
      vi.stubGlobal('fetch', fetchMock)

      let capturedContext: ReturnType<typeof useSocketContext> | null = null
      function Consumer() {
        capturedContext = useSocketContext()
        return null
      }

      await act(async () => {
        root!.render(
          <SocketProvider>
            <Consumer />
          </SocketProvider>,
        )
      })

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/identity/bootstrap'),
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      )
      expect(mockSocket.connect).toHaveBeenCalled()
      expect(capturedContext!.socket).toBe(mockSocket)

      // Verify socket events update isConnected
      await act(async () => {
        mockSocket.emitEvent('connect')
      })
      expect(capturedContext!.isConnected).toBe(true)

      await act(async () => {
        mockSocket.emitEvent('disconnect')
      })
      expect(capturedContext!.isConnected).toBe(false)

      // Unmount and verify 3 listeners off called
      await act(async () => {
        root!.unmount()
        root = null
      })

      expect(mockSocket.off).toHaveBeenCalledWith('connect', expect.any(Function))
      expect(mockSocket.off).toHaveBeenCalledWith('disconnect', expect.any(Function))
      expect(mockSocket.off).toHaveBeenCalledWith('connect_error', expect.any(Function))
      expect(mockSocket.listenerCount('connect')).toBe(0)
      expect(mockSocket.listenerCount('disconnect')).toBe(0)
      expect(mockSocket.listenerCount('connect_error')).toBe(0)
    })

    it('does not connect if bootstrap fails', async () => {
      const mockSocket = createMockSocket()
      getSocketMock.mockReturnValue(mockSocket)

      const fetchMock = vi.fn(async () => ({
        ok: false,
        headers: new Headers(),
      }))
      vi.stubGlobal('fetch', fetchMock)

      await act(async () => {
        root!.render(
          <SocketProvider>
            <div />
          </SocketProvider>,
        )
      })

      expect(mockSocket.connect).not.toHaveBeenCalled()
    })
  })
})
