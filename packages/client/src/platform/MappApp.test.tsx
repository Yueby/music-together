// @vitest-environment jsdom
import { act, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocation } from 'react-router'
import { useSocketContext } from '@/providers/SocketProvider'
import type { MappHost } from '../../../mapp/src/compat/MappHost'
import type { TypedSocket } from '@/lib/socket'
import type { MappSessionLike, MappSessionSnapshot } from '@/providers/MappSocketProvider'

const hostRuntimeMock = vi.hoisted(() => ({ kind: 'mapp' as 'web' | 'mapp' }))
const resetAllRoomStateMock = vi.hoisted(() => vi.fn())
const appSurfaceRenderMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/hostRuntime', () => ({
  hostRuntime: hostRuntimeMock,
}))

vi.mock('@/lib/resetStores', () => ({
  resetAllRoomState: resetAllRoomStateMock,
}))

vi.mock('@/App', () => ({
  AppSurface: ({ onReset }: { onReset?: () => void }) => {
    appSurfaceRenderMock(onReset)
    return <MockAppSurface onReset={onReset} />
  },
}))

function MockAppSurface({ onReset }: { onReset?: () => void }) {
  const location = useLocation()
  const socketContext = useSocketContext()
  return (
    <div data-testid="mock-surface">
      <div data-testid="current-path">{location.pathname}</div>
      <div data-testid="socket-connected">{String(socketContext.isConnected)}</div>
      <button data-testid="reset-button" type="button" onClick={onReset}>
        Reset
      </button>
    </div>
  )
}

function createFakeSession(
  initialSnapshot: MappSessionSnapshot = { connected: true, userId: 'mapp_user_1' },
): MappSessionLike & {
  setSnapshot(next: MappSessionSnapshot): void
  listenerCount(): number
} {
  let currentSnapshot: MappSessionSnapshot = Object.freeze({ ...initialSnapshot })
  const listeners = new Set<() => void>()
  const fakeSocket = {
    id: 'mock-socket-id',
    connected: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    emit: vi.fn(),
  } as unknown as TypedSocket

  return {
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
    listenerCount: () => listeners.size,
    setSnapshot(next: MappSessionSnapshot) {
      currentSnapshot = Object.freeze({ ...next })
      listeners.forEach((listener) => listener())
    },
  }
}

function createFakeHost(session = createFakeSession()): {
  host: MappHost
  session: ReturnType<typeof createFakeSession>
  leaveMock: ReturnType<typeof vi.fn>
  connectMock: ReturnType<typeof vi.fn>
  disposeMock: ReturnType<typeof vi.fn>
} {
  const leaveMock = vi.fn()
  const connectMock = vi.fn()
  const disposeMock = vi.fn()

  const host = {
    serverOrigin: 'https://music.example.test',
    session,
    playbackSoundFactory: {},
    roomCommands: {
      create: vi.fn(),
      join: vi.fn(),
      leave: leaveMock,
    },
    metadataFetch: vi.fn(),
    roomCheck: vi.fn(),
    isAudioUnlocked: vi.fn(() => true),
    unlockAudio: vi.fn(async () => {}),
    connect: connectMock,
    dispose: disposeMock,
  } as unknown as MappHost

  return { host, session, leaveMock, connectMock, disposeMock }
}

describe('MappApp minimal host shell', () => {
  let container: HTMLDivElement | null = null
  let root: ReturnType<typeof createRoot> | null = null

  beforeEach(() => {
    vi.restoreAllMocks()
    hostRuntimeMock.kind = 'mapp'
    resetAllRoomStateMock.mockClear()
    appSurfaceRenderMock.mockClear()

    const tripwireFetch = vi.fn(() => {
      throw new Error('Tripwire: fetch must never be called during MappApp execution')
    })
    vi.stubGlobal('fetch', tripwireFetch)
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount()
      })
      root = null
    }
    if (container?.parentNode) {
      container.parentNode.removeChild(container)
      container = null
    }
    expect(globalThis.fetch).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('rejects render with fixed MAPP_BINDINGS_REQUIRED when hostRuntime is web', async () => {
    hostRuntimeMock.kind = 'web'
    const { MappApp } = await import('./MappApp')
    const { host } = createFakeHost()

    expect(() => renderToString(<MappApp host={host} />)).toThrow('MAPP_BINDINGS_REQUIRED')
  })

  it('routes valid initialRoomId to /room/:roomId and invalid/empty to /', async () => {
    const { MappApp } = await import('./MappApp')
    const initialUrl = window.location.href
    const initialHistoryLength = window.history.length

    // Valid room ID matching ^[A-Za-z0-9_-]{1,20}$
    const { host: host1 } = createFakeHost()
    await act(async () => {
      root!.render(<MappApp key="valid-room" host={host1} initialRoomId="Valid_Room-123" />)
    })
    expect(container?.querySelector('[data-testid="current-path"]')?.textContent).toBe('/room/Valid_Room-123')

    // Invalid room ID with illegal characters
    const { host: host2 } = createFakeHost()
    await act(async () => {
      root!.render(<MappApp key="invalid-room" host={host2} initialRoomId="bad room id with spaces!" />)
    })
    expect(container?.querySelector('[data-testid="current-path"]')?.textContent).toBe('/')

    // Invalid room ID exceeding 20 chars
    const { host: host3 } = createFakeHost()
    await act(async () => {
      root!.render(<MappApp key="long-room" host={host3} initialRoomId={'a'.repeat(21)} />)
    })
    expect(container?.querySelector('[data-testid="current-path"]')?.textContent).toBe('/')

    // Empty string
    const { host: host4 } = createFakeHost()
    await act(async () => {
      root!.render(<MappApp key="empty-room" host={host4} initialRoomId="" />)
    })
    expect(container?.querySelector('[data-testid="current-path"]')?.textContent).toBe('/')

    // Undefined
    const { host: host5 } = createFakeHost()
    await act(async () => {
      root!.render(<MappApp key="lobby" host={host5} />)
    })
    expect(container?.querySelector('[data-testid="current-path"]')?.textContent).toBe('/')

    // Window location and history must remain unchanged
    expect(window.location.href).toBe(initialUrl)
    expect(window.history.length).toBe(initialHistoryLength)
  })

  it('projects socket and identity state through MappSocketProvider to children', async () => {
    const { MappApp } = await import('./MappApp')
    const session = createFakeSession({ connected: true, userId: 'mapp_verified_user' })
    const { host } = createFakeHost(session)

    await act(async () => {
      root!.render(<MappApp host={host} initialRoomId="ABC123" />)
    })

    expect(container?.querySelector('[data-testid="socket-connected"]')?.textContent).toBe('true')

    // When session loses connection/user, projection updates
    await act(async () => {
      session.setSnapshot({ connected: false, userId: null })
    })
    expect(container?.querySelector('[data-testid="socket-connected"]')?.textContent).toBe('false')
  })

  it('performs root error reset with leave, resetAllRoomState, and in-memory navigate without touching host lifecycle or window', async () => {
    const { MappApp } = await import('./MappApp')
    const initialUrl = window.location.href
    const initialHistoryLength = window.history.length
    const { host, leaveMock, connectMock, disposeMock } = createFakeHost()

    await act(async () => {
      root!.render(<MappApp host={host} initialRoomId="TestRoom" />)
    })

    expect(container?.querySelector('[data-testid="current-path"]')?.textContent).toBe('/room/TestRoom')

    const resetButton = container?.querySelector('[data-testid="reset-button"]') as HTMLButtonElement
    expect(resetButton).toBeTruthy()

    await act(async () => {
      resetButton.click()
    })

    // Reset contract:
    // 1. host.roomCommands.leave(host.session.socket) called
    expect(leaveMock).toHaveBeenCalledTimes(1)
    expect(leaveMock).toHaveBeenCalledWith(host.session.socket)

    // 2. resetAllRoomState() called
    expect(resetAllRoomStateMock).toHaveBeenCalledTimes(1)

    // 3. in-memory navigate to '/'
    expect(container?.querySelector('[data-testid="current-path"]')?.textContent).toBe('/')

    // 4. host.connect() and host.dispose() must NOT be called
    expect(connectMock).not.toHaveBeenCalled()
    expect(disposeMock).not.toHaveBeenCalled()

    // 5. window.location and history must remain unchanged (no forum reload)
    expect(window.location.href).toBe(initialUrl)
    expect(window.history.length).toBe(initialHistoryLength)
  })

  it('StrictMode unmount does not dispose host or disconnect session', async () => {
    const { MappApp } = await import('./MappApp')
    const session = createFakeSession({ connected: true, userId: 'user-1' })
    const { host, disposeMock, connectMock } = createFakeHost(session)

    await act(async () => {
      root!.render(
        <StrictMode>
          <MappApp host={host} initialRoomId="StrictRoom" />
        </StrictMode>,
      )
    })

    expect(container?.querySelector('[data-testid="current-path"]')?.textContent).toBe('/room/StrictRoom')
    expect(session.listenerCount()).toBeGreaterThan(0)

    await act(async () => {
      root!.unmount()
      root = null
    })

    // Session subscription is cleaned up, but host itself is neither connected nor disposed by React unmount
    expect(session.listenerCount()).toBe(0)
    expect(disposeMock).not.toHaveBeenCalled()
    expect(connectMock).not.toHaveBeenCalled()
  })
})
