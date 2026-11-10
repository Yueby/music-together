// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRoomStore } from '@/stores/roomStore'
import RoomPage from './RoomPage'

const fixture = vi.hoisted(() => ({
  context: {
    socket: { id: 'fixture-socket', on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    isConnected: true,
    requiresManualJoin: false,
  },
  commands: { create: vi.fn(), join: vi.fn(() => true), leave: vi.fn() },
  unlocked: true,
  unlock: vi.fn(async () => {}),
  navigate: vi.fn(),
}))
vi.mock('react-router', () => ({ useParams: () => ({ roomId: 'ABC123' }), useNavigate: () => fixture.navigate }))
vi.mock('motion/react', () => ({ motion: { div: ({ children }: { children: ReactNode }) => <div>{children}</div> } }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('@/providers/SocketProvider', () => ({ useSocketContext: () => fixture.context }))
vi.mock('@/providers/AbilityProvider', () => ({ AbilityProvider: ({ children }: { children: ReactNode }) => children }))
vi.mock('@/stores/chatStore', () => {
  const state = { isChatOpen: false, unreadCount: 0, setIsChatOpen: vi.fn() }
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
  },
}))
vi.mock('@/hooks/useRoom', () => ({
  useRoom: () => ({ leaveRoom: vi.fn(), updateSettings: vi.fn(), setUserRole: vi.fn() }),
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
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }))
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
vi.mock('@/components/Chat/ChatPanel', () => ({ ChatPanel: () => null }))
vi.mock('@/components/Room/RoomHeader', () => ({ RoomHeader: () => null }))
vi.mock('@/components/Overlays/SearchDialog', () => ({ SearchDialog: () => null }))
vi.mock('@/components/Overlays/QueueDrawer', () => ({ QueueDrawer: () => null }))
vi.mock('@/components/Overlays/SettingsDialog', () => ({ SettingsDialog: () => null }))
vi.mock('@/components/Lobby/PasswordDialog', () => ({ PasswordDialog: () => null }))
vi.mock('@/components/ui/drawer', () => ({
  Drawer: () => null,
  DrawerContent: () => null,
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
    fixture.context.requiresManualJoin = false
    fixture.unlocked = true
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
    container.remove()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })
  async function render() {
    await act(async () => root.render(<RoomPage />))
  }
  async function click(text: string) {
    const button = [...container.querySelectorAll('button')].find((element) => element.textContent === text)
    expect(button).toBeDefined()
    await act(async () => button!.click())
  }

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
})
