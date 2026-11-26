// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SocketProvider, SocketStateProvider, useSocketContext } from './SocketProvider'
import type { TypedSocket } from '@/lib/socket'
import { EVENTS, PROTOCOL_VERSION } from '@music-together/shared'
import { useVersionStore } from '@/stores/versionStore'

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
    info: vi.fn(),
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
    vi.useRealTimers()
    useVersionStore.setState({ hasUpdate: false, breakingUpdate: false })
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
    it('executes bootstrap POST with credentials include, connects on success, and unregisters listeners', async () => {
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
      expect(mockSocket.listenerCount(EVENTS.SERVER_HELLO)).toBe(0)
      expect(mockSocket.listenerCount(EVENTS.SERVER_RESTARTING)).toBe(0)
    })

    it('checks the server build on every handshake, including reconnect', async () => {
      const mockSocket = createMockSocket()
      getSocketMock.mockReturnValue(mockSocket)
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, headers: new Headers() })))
      vi.stubGlobal('__APP_VERSION__', '1.0.1')
      vi.stubGlobal('__BUILD_ID__', 'first-build')
      await act(async () => root!.render(<SocketProvider><div /></SocketProvider>))
      const hello = { version: '1.0.1', buildId: 'first-build', protocol: PROTOCOL_VERSION }
      await act(async () => {
        mockSocket.emitEvent('connect')
        mockSocket.emitEvent(EVENTS.SERVER_HELLO, hello)
      })
      expect(useVersionStore.getState().hasUpdate).toBe(false)

      await act(async () => {
        mockSocket.emitEvent('disconnect', 'transport close')
        mockSocket.emitEvent('connect')
        mockSocket.emitEvent(EVENTS.SERVER_HELLO, { ...hello, buildId: 'second-build' })
      })
      expect(useVersionStore.getState()).toEqual({ hasUpdate: true, breakingUpdate: false })
    })

    it('reconnects after a server-initiated disconnect using the restart advisory', async () => {
      vi.useFakeTimers()
      const mockSocket = createMockSocket()
      getSocketMock.mockReturnValue(mockSocket)
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, headers: new Headers() })))
      await act(async () => root!.render(<SocketProvider><div /></SocketProvider>))
      mockSocket.connect.mockClear()
      await act(async () => {
        mockSocket.emitEvent(EVENTS.SERVER_RESTARTING, { retryAfterMs: 1000 })
        mockSocket.emitEvent('disconnect', 'io server disconnect')
      })
      vi.advanceTimersByTime(999)
      expect(mockSocket.connect).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1)
      expect(mockSocket.connect).toHaveBeenCalledOnce()
    })

    it('retries failed bootstrap with capped exponential backoff until it connects', async () => {
      vi.useFakeTimers()
      const mockSocket = createMockSocket()
      getSocketMock.mockReturnValue(mockSocket)
      const fetchMock = vi.fn(async () => new Response(null, { status: 503 }))
      vi.stubGlobal('fetch', fetchMock)
      await act(async () => root!.render(<SocketProvider><div /></SocketProvider>))

      expect(fetchMock).toHaveBeenCalledOnce()
      for (const delay of [1_000, 2_000, 4_000, 8_000, 16_000, 30_000]) {
        const calls = fetchMock.mock.calls.length
        await vi.advanceTimersByTimeAsync(delay - 1)
        expect(fetchMock).toHaveBeenCalledTimes(calls)
        await vi.advanceTimersByTimeAsync(1)
        expect(fetchMock).toHaveBeenCalledTimes(calls + 1)
      }

      expect(mockSocket.connect).not.toHaveBeenCalled()
      fetchMock.mockResolvedValueOnce(new Response())
      await vi.advanceTimersByTimeAsync(30_000)
      expect(mockSocket.connect).toHaveBeenCalledOnce()
      await vi.advanceTimersByTimeAsync(60_000)
      expect(fetchMock).toHaveBeenCalledTimes(8)
    })

    it.each(['online', 'visibilitychange'])('retries immediately on %s and clears the backoff timer', async (event) => {
      vi.useFakeTimers()
      const mockSocket = createMockSocket()
      getSocketMock.mockReturnValue(mockSocket)
      const fetchMock = vi.fn(async () => new Response())
        .mockRejectedValueOnce(new Error('offline'))
      vi.stubGlobal('fetch', fetchMock)
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
      await act(async () => root!.render(<SocketProvider><div /></SocketProvider>))
      const target = event === 'online' ? window : document
      await act(async () => { target.dispatchEvent(new Event(event)) })
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(mockSocket.connect).toHaveBeenCalledOnce()
      await vi.advanceTimersByTimeAsync(1_000)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('aborts in-flight bootstrap on unmount and ignores a late success', async () => {
      const mockSocket = createMockSocket()
      getSocketMock.mockReturnValue(mockSocket)
      let complete!: (response: Response) => void
      let signal: AbortSignal | null | undefined
      const fetchMock = vi.fn((_url: string, options: RequestInit) => {
        signal = options.signal
        return new Promise<Response>((resolve) => { complete = resolve })
      })
      vi.stubGlobal('fetch', fetchMock)
      await act(async () => root!.render(<SocketProvider><div /></SocketProvider>))
      act(() => window.dispatchEvent(new Event('online')))
      expect(fetchMock).toHaveBeenCalledOnce()
      act(() => root!.unmount())
      root = null
      expect(signal?.aborted).toBe(true)
      await act(async () => { complete(new Response()) })
      expect(mockSocket.connect).not.toHaveBeenCalled()
    })

    it('clears a pending bootstrap retry and recovery listeners on unmount', async () => {
      vi.useFakeTimers()
      getSocketMock.mockReturnValue(createMockSocket())
      const fetchMock = vi.fn(async () => new Response(null, { status: 503 }))
      vi.stubGlobal('fetch', fetchMock)
      await act(async () => root!.render(<SocketProvider><div /></SocketProvider>))
      act(() => root!.unmount())
      root = null
      window.dispatchEvent(new Event('online'))
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.advanceTimersByTimeAsync(30_000)
      expect(fetchMock).toHaveBeenCalledOnce()
    })
  })
})
