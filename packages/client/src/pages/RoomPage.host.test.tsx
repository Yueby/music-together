// @vitest-environment jsdom
import { act, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ERROR_CODE, EVENTS, type RoomState } from '@music-together/shared'
import { useRoomStore } from '@/stores/roomStore'
import RoomPage from './RoomPage'

const fixture = vi.hoisted(() => ({
  context: {
    socket: { id: 'fixture-socket', connected: true, on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    isConnected: true,
    requiresManualJoin: false,
  },
  commands: { create: vi.fn(), join: vi.fn(() => true), leave: vi.fn() },
  leaveRoom: vi.fn(),
  unlocked: true,
  unlock: vi.fn(async () => {}),
  navigate: vi.fn(),
  mobile: false,
  chatOpen: false,
}))
vi.mock('react-router', () => ({ useParams: () => ({ roomId: 'ABC123' }), useNavigate: () => fixture.navigate }))
vi.mock('motion/react', () => ({
  motion: { div: ({ children }: { children: ReactNode }) => <div>{children}</div> },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('@/providers/SocketProvider', () => ({ useSocketContext: () => fixture.context }))
vi.mock('@/providers/AbilityProvider', () => ({
  AbilityProvider: ({ children }: { children: ReactNode }) => children,
  useAppAbility: () => ({ can: () => true }),
}))
vi.mock('@/stores/chatStore', () => {
  const state = {
    get isChatOpen() {
      return fixture.chatOpen
    },
    unreadCount: 0,
    setIsChatOpen: vi.fn(),
  }
  return {
    useChatStore: Object.assign((select: (value: typeof state) => unknown) => select(state), { getState: () => state }),
  }
})
vi.mock('@/lib/RoomCommands', () => ({ roomCommands: fixture.commands }))
vi.mock('@/lib/audioUnlock', () => ({ isAudioUnlocked: () => fixture.unlocked, unlockAudio: fixture.unlock }))
vi.mock('@/lib/storage', () => ({
  storage: {
    getNickname: () => 'Fixture listener',
    getUserId: () => '',
    getRejoinToken: () => 'fixture-web-ticket',
    hasAuthCookie: () => false,
    getVolume: () => 0.8,
    getAudioLatencyOffsetMs: () => null,
    setVolume: vi.fn(),
  },
}))
vi.mock('@/hooks/useRoom', () => ({
  useRoom: () => ({ leaveRoom: fixture.leaveRoom, updateSettings: vi.fn(), setUserRole: vi.fn() }),
}))
vi.mock('@/hooks/usePlayer', () => ({
  usePlayer: () => ({ play: vi.fn(), pause: vi.fn(), seek: vi.fn(), next: vi.fn(), prev: vi.fn() }),
}))
vi.mock('@/hooks/useQueue', () => ({
  useQueue: () => ({
    addTrack: vi.fn(),
    insertAfterCurrent: vi.fn(),
    removeTrack: vi.fn(),
    reorderTracks: vi.fn(),
    clearQueue: vi.fn(),
  }),
}))
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => fixture.mobile }))
vi.mock('@/hooks/useClockSync', () => ({ useClockSync: () => {} }))
vi.mock('@/components/InteractionGate', () => ({
  InteractionGate: ({ onStart }: { onStart: (password?: string) => Promise<void> }) => (
    <div>
      <button onClick={() => void onStart('fixture-password')}>Enter with password</button>
      <button onClick={() => void onStart()}>Enter without cached password</button>
    </div>
  ),
}))
vi.mock('@/components/Player/AudioPlayer', () => ({ AudioPlayer: () => null }))
vi.mock('@/components/Chat/ChatPanel', () => ({ ChatPanel: () => <div data-testid="chat-panel" /> }))
vi.mock('@/components/Room/RoomHeader', () => ({
  RoomHeader: ({ onLeaveRoom }: { onLeaveRoom: () => void }) => <button onClick={onLeaveRoom}>Leave room</button>,
}))
vi.mock('@/components/Overlays/SearchDialog', () => ({ SearchDialog: () => null }))
vi.mock('@/components/Overlays/QueueDrawer', () => ({ QueueDrawer: () => null }))
vi.mock('@/components/Overlays/SettingsDialog', () => ({ SettingsDialog: () => null }))
vi.mock('@/components/Overlays/Settings/PlatformHub', () => ({ PlatformHub: () => null }))
vi.mock('@/components/Lobby/PasswordDialog', () => ({ PasswordDialog: () => null }))
vi.mock('@/components/ui/drawer', () => ({
  Drawer: ({ children }: { children: ReactNode }) => <div data-testid="chat-drawer">{children}</div>,
  DrawerContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  DrawerHeader: () => null,
  DrawerTitle: () => null,
}))

describe('shared RoomPage host room commands', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  beforeEach(() => {
    vi.clearAllMocks()
    fixture.commands.join.mockReturnValue(true)
    fixture.context.isConnected = true
    fixture.context.socket.connected = true
    fixture.context.requiresManualJoin = false
    fixture.unlocked = true
    fixture.mobile = false
    fixture.chatOpen = false
    useRoomStore.getState().reset()
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ name: 'Fixture room', hasPassword: true, userCount: 1 }) })),
    )
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(async () => {
    await act(async () => root.unmount())
    if (vi.isFakeTimers()) vi.runOnlyPendingTimers()
    else await new Promise<void>((resolve) => setTimeout(resolve, 0))
    container.remove()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })
  async function render() {
    await act(async () => root.render(<RoomPage />))
  }
  async function click(text: string) {
    const button = [...container.querySelectorAll('button')].find((element) => element.textContent === text)
    expect(button).toBeDefined()
    await act(async () => button!.click())
  }

  describe('leaving without the leave button', () => {
    const joinedRoom = { id: 'ABC123', name: 'Fixture room', users: [] } as unknown as RoomState
    const nextMacrotask = () => act(async () => void (await new Promise<void>((resolve) => setTimeout(resolve, 0))))
    async function unmount() {
      await act(async () => root.unmount())
      await nextMacrotask()
      root = createRoot(container)
    }

    it('leaves the room when the page unmounts while joined (browser back, route change)', async () => {
      useRoomStore.setState({ room: joinedRoom })
      await render()
      expect(fixture.leaveRoom).not.toHaveBeenCalled()

      await unmount()
      expect(fixture.leaveRoom).toHaveBeenCalledOnce()
    })

    it('does not leave on the simulated unmount of a StrictMode double mount', async () => {
      useRoomStore.setState({ room: joinedRoom })
      await act(async () => root.render(<StrictMode><RoomPage /></StrictMode>))
      await nextMacrotask()
      expect(fixture.leaveRoom).not.toHaveBeenCalled()

      await unmount()
      expect(fixture.leaveRoom).toHaveBeenCalledOnce()
    })

    it('does not leave a second time after the explicit leave button was used', async () => {
      useRoomStore.setState({ room: joinedRoom })
      await render()
      await click('Leave room')
      expect(fixture.leaveRoom).toHaveBeenCalledOnce()
      expect(fixture.navigate).toHaveBeenCalledWith('/', { replace: true })

      await unmount()
      expect(fixture.leaveRoom).toHaveBeenCalledOnce()
    })

    it('leaves when a join is still in flight on unmount', async () => {
      await render()
      expect(fixture.commands.join).toHaveBeenCalledOnce()
      expect(useRoomStore.getState().room).toBeNull()

      await unmount()
      expect(fixture.leaveRoom).toHaveBeenCalledOnce()
    })

    it('does nothing when the user never entered the room (still at the interaction gate)', async () => {
      fixture.unlocked = false
      await render()
      expect(fixture.commands.join).not.toHaveBeenCalled()

      await unmount()
      expect(fixture.leaveRoom).not.toHaveBeenCalled()
    })

    it('delegates local leave to cancel recovery when unmounting during an outage', async () => {
      useRoomStore.setState({ room: joinedRoom })
      await render()
      fixture.context.socket.connected = false

      await unmount()
      expect(fixture.leaveRoom).toHaveBeenCalledOnce()
      expect(fixture.context.socket.emit).not.toHaveBeenCalled()
    })
  })

  it('joins again after a reconnect even if the previous join was never answered', async () => {
    await render()
    expect(fixture.commands.join).toHaveBeenCalledTimes(1)

    // Connection drops after ROOM_JOIN was sent but before ROOM_STATE came back.
    fixture.context.isConnected = false
    fixture.context.socket.connected = false
    await render()
    expect(fixture.commands.join).toHaveBeenCalledTimes(1)

    fixture.context.isConnected = true
    fixture.context.socket.connected = true
    await render()
    expect(fixture.commands.join).toHaveBeenCalledTimes(2)
    expect(fixture.commands.join).toHaveBeenLastCalledWith(
      fixture.context.socket,
      expect.objectContaining({ roomId: 'ABC123' }),
      { automatic: true },
    )
  })

  it.each([
    ERROR_CODE.ROOM_ENTRY_LIMITED,
    ERROR_CODE.SERVER_FULL,
    ERROR_CODE.RATE_LIMITED,
    ERROR_CODE.SERVER_RESTARTING,
  ])('retries after %s and clears the reconnect notice on confirmation', async (code) => {
    vi.useFakeTimers()
    const room = { id: 'ABC123', name: 'Fixture room', users: [] } as unknown as RoomState
    useRoomStore.getState().setRoom(room)
    await render()
    expect(fixture.commands.join).not.toHaveBeenCalled()

    fixture.context.isConnected = false
    fixture.context.socket.connected = false
    await act(async () => useRoomStore.getState().setConnectionStatus('reconnecting'))
    expect(container.textContent).toContain('连接中断，正在重连')
    expect(fixture.commands.join).not.toHaveBeenCalled()

    fixture.context.isConnected = true
    fixture.context.socket.connected = true
    await render()
    expect(fixture.commands.join).toHaveBeenCalledOnce()
    const roomError = fixture.context.socket.on.mock.calls.filter(([event]) => event === EVENTS.ROOM_ERROR).at(-1)![1]
    await act(async () => roomError({ code, message: 'Try again later' }))
    expect(fixture.leaveRoom).not.toHaveBeenCalled()
    expect(useRoomStore.getState().connectionStatus).toBe('reconnecting')
    await act(async () => { await vi.advanceTimersByTimeAsync(999) })
    expect(fixture.commands.join).toHaveBeenCalledOnce()
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(fixture.commands.join).toHaveBeenCalledTimes(2)

    await act(async () => useRoomStore.getState().setRoom(room))
    expect(container.textContent).not.toContain('连接中断，正在重连')
  })

  it('cancels a pending retry when a reconnect password is rejected', async () => {
    vi.useFakeTimers()
    const room = { id: 'ABC123', name: 'Fixture room', users: [] } as unknown as RoomState
    useRoomStore.getState().setRoom(room)
    useRoomStore.getState().setConnectionStatus('reconnecting')
    await render()

    const roomError = fixture.context.socket.on.mock.calls.filter(([event]) => event === EVENTS.ROOM_ERROR).at(-1)![1]
    await act(async () => roomError({ code: ERROR_CODE.ROOM_ENTRY_LIMITED, message: 'Try again later' }))
    await act(async () => roomError({ code: ERROR_CODE.WRONG_PASSWORD, message: 'Wrong password' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })

    expect(fixture.leaveRoom).toHaveBeenCalledOnce()
    expect(fixture.commands.join).toHaveBeenCalledOnce()
  })

  it('delegates automatic entry through the host command boundary', async () => {
    await render()
    expect(fixture.commands.join).toHaveBeenCalledExactlyOnceWith(
      fixture.context.socket,
      {
        roomId: 'ABC123',
        nickname: 'Fixture listener',
        password: undefined,
        rejoinToken: 'fixture-web-ticket',
      },
      { automatic: true },
    )
    expect(fixture.context.socket.emit).not.toHaveBeenCalled()
  })

  it('waits for a new user gesture after failed recovery without replaying credentials', async () => {
    fixture.context.requiresManualJoin = true
    await render()
    expect(fixture.commands.join).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Enter with password')
    await click('Enter with password')
    expect(fixture.unlock).toHaveBeenCalledOnce()
    expect(fixture.commands.join).toHaveBeenCalledExactlyOnceWith(
      fixture.context.socket,
      {
        roomId: 'ABC123',
        nickname: 'Fixture listener',
        password: 'fixture-password',
        rejoinToken: 'fixture-web-ticket',
      },
      { automatic: false },
    )
  })

  it('clears the previous password when a later identity or recovery boundary requires manual entry', async () => {
    fixture.unlocked = false
    await render()
    await click('Enter with password')
    expect(fixture.commands.join).toHaveBeenCalledTimes(1)
    fixture.context.requiresManualJoin = true
    await render()
    expect(fixture.commands.join).toHaveBeenCalledTimes(1)
    await click('Enter without cached password')
    expect(fixture.commands.join).toHaveBeenLastCalledWith(
      fixture.context.socket,
      {
        roomId: 'ABC123',
        nickname: 'Fixture listener',
        password: undefined,
        rejoinToken: 'fixture-web-ticket',
      },
      { automatic: false },
    )
  })

  describe('chat placement', () => {
    const joinedRoom = { id: 'ABC123', name: 'Fixture room', users: [] } as unknown as RoomState

    it.each([
      ['landscape', false, 1, 0],
      ['portrait', true, 1, 1],
    ])('shows the chat in exactly one place in %s', async (_name, mobile, panels, drawers) => {
      fixture.mobile = mobile
      fixture.chatOpen = true
      useRoomStore.setState({ room: joinedRoom })
      await render()

      expect(container.querySelectorAll('[data-testid="chat-panel"]')).toHaveLength(panels)
      expect(container.querySelectorAll('[data-testid="chat-drawer"] [data-testid="chat-panel"]')).toHaveLength(drawers)
    })
  })
})
