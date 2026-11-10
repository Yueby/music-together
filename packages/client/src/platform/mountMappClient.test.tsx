// @vitest-environment jsdom
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MappHost } from '../../../mapp/src/compat/MappHost'
import type { MappRoomSession } from '../../../mapp/src/compat/RoomSession'
import type { PlaybackSoundFactory } from '../lib/PlaybackSound'
import type { RoomCommands } from '../lib/RoomCommands'
import type { MetadataFetch } from '../lib/MetadataTransport'
import type { RoomCheckReader } from '../lib/RoomCheckReader'
import { mountMappClient, MAPP_RENDER_FAILED } from './mountMappClient'

const resetAllRoomStateMock = vi.hoisted(() => vi.fn())
const mappAppRenderMock = vi.hoisted(() => vi.fn())

let simulateMappAppError: Error | null = null

vi.mock('@/lib/resetStores', () => ({
  resetAllRoomState: resetAllRoomStateMock,
}))

vi.mock('./MappApp', () => ({
  MappApp: ({ host, initialRoomId }: { host: MappHost; initialRoomId?: string }) => {
    mappAppRenderMock({ host, initialRoomId })
    if (simulateMappAppError) {
      throw simulateMappAppError
    }
    return (
      <div data-testid="mock-mapp-app">
        <span data-testid="room-id">{initialRoomId ?? 'none'}</span>
        <span data-testid="server-origin">{host.serverOrigin}</span>
      </div>
    )
  },
}))

interface FakeHostBundle {
  host: MappHost
  connectMock: ReturnType<typeof vi.fn>
  disposeMock: ReturnType<typeof vi.fn>
}

function createFakeMappHost(): FakeHostBundle {
  const connectMock = vi.fn()
  const disposeMock = vi.fn().mockResolvedValue(undefined)

  const fakeSession = {
    socket: {} as MappRoomSession['socket'],
    snapshot: {
      status: 'idle',
      connected: false,
      userId: null,
      roomId: null,
      errorCode: null,
    },
    subscribe: vi.fn(() => () => {}),
  } as unknown as MappRoomSession

  const host: MappHost = {
    serverOrigin: 'https://discourse.example.test',
    session: fakeSession,
    playbackSoundFactory: {} as PlaybackSoundFactory,
    roomCommands: {
      create: vi.fn(),
      join: vi.fn(),
      leave: vi.fn(),
    } as unknown as RoomCommands,
    metadataFetch: vi.fn() as unknown as MetadataFetch,
    artworkLoader: { direct: false, load: vi.fn() },
    roomCheck: vi.fn() as unknown as RoomCheckReader,
    isAudioUnlocked: vi.fn(() => true),
    unlockAudio: vi.fn().mockResolvedValue(undefined),
    connect: connectMock,
    dispose: disposeMock,
  }

  return { host, connectMock, disposeMock }
}

describe('mountMappClient', () => {
  let container: HTMLDivElement | null = null

  beforeEach(() => {
    vi.restoreAllMocks()
    resetAllRoomStateMock.mockClear()
    mappAppRenderMock.mockClear()
    simulateMappAppError = null
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container)
    }
    container = null
    vi.unstubAllGlobals()
  })

  it('resolves unmount function after mounted effect and calls resetAllRoomState before render', async () => {
    const { host, connectMock, disposeMock } = createFakeMappHost()
    const callOrder: string[] = []

    resetAllRoomStateMock.mockImplementation(() => {
      callOrder.push('resetAllRoomState')
    })
    mappAppRenderMock.mockImplementation(() => {
      callOrder.push('renderMappApp')
    })

    let mountPromise!: Promise<() => void>
    await act(async () => {
      mountPromise = mountMappClient(container!, host, 'room-123')
      expect(callOrder[0]).toBe('resetAllRoomState')
    })
    const unmountFn = await mountPromise

    expect(typeof unmountFn).toBe('function')
    expect(callOrder).toContain('resetAllRoomState')
    expect(callOrder).toContain('renderMappApp')
    expect(container?.querySelector('[data-testid="mock-mapp-app"]')).not.toBeNull()
    expect(container?.querySelector('[data-testid="room-id"]')?.textContent).toBe('room-123')

    // Host must NOT be connected or disposed by mountMappClient
    expect(connectMock).not.toHaveBeenCalled()
    expect(disposeMock).not.toHaveBeenCalled()

    // Unmount idempotency
    await act(async () => {
      unmountFn!()
      unmountFn!()
    })

    expect(container?.innerHTML).toBe('')
    // Host is still untouched
    expect(connectMock).not.toHaveBeenCalled()
    expect(disposeMock).not.toHaveBeenCalled()
  })

  it('remains stable and settles only once under React StrictMode double effect', async () => {
    const { host } = createFakeMappHost()

    let settleCount = 0
    let unmountFn: (() => void) | null = null

    let mounted!: Promise<void>
    await act(async () => {
      mounted = mountMappClient(container!, host).then((fn) => {
        settleCount += 1
        unmountFn = fn
      })
    })
    await mounted

    expect(settleCount).toBe(1)
    expect(unmountFn).not.toBeNull()

    await act(async () => {
      unmountFn!()
    })
  })

  it('never calls native fetch, modifies location, or modifies history', async () => {
    const { host } = createFakeMappHost()
    const fetchMock = vi.fn(() => {
      throw new Error('Tripwire: native fetch must never be invoked during mount')
    })
    vi.stubGlobal('fetch', fetchMock)

    const initialHref = window.location.href
    const initialHistoryLength = window.history.length

    let mounted!: Promise<() => void>
    await act(async () => {
      mounted = mountMappClient(container!, host, 'room-abc')
    })
    const unmountFn = await mounted

    expect(fetchMock).not.toHaveBeenCalled()
    expect(window.location.href).toBe(initialHref)
    expect(window.history.length).toBe(initialHistoryLength)

    await act(async () => {
      unmountFn!()
    })

    vi.unstubAllGlobals()
  })

  it('rejects with fixed MAPP_RENDER_FAILED error without leaking original sensitive error or URL', async () => {
    const { host } = createFakeMappHost()
    simulateMappAppError = new Error('Sensitive SQL/Token error at https://secret.example.com/api/token?key=12345')

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // act intentionally rethrows React render errors; exercise the production root callback here.
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', false)
    const capturedError = await mountMappClient(container!, host).then(
      () => null,
      (error: unknown) => (error instanceof Error ? error : new Error('UNEXPECTED_FIXTURE_ERROR')),
    )

    expect(capturedError).not.toBeNull()
    expect(capturedError?.message).toBe(MAPP_RENDER_FAILED)
    expect(capturedError?.message).not.toContain('secret.example.com')
    expect(capturedError?.message).not.toContain('Sensitive')

    // Root is cleared
    expect(container?.innerHTML).toBe('')
    consoleErrorSpy.mockRestore()
  })
})
