// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ERROR_CODE, EVENTS, type RoomState } from '@music-together/shared'
import { authAutoResend } from '@/lib/authAutoResend'
import { registerActivePlaybackStop } from '@/lib/audioPlaybackLifecycle'
import { registerPendingPlayCancel } from '@/lib/scheduledPlayback'
import { usePlayerStore } from '@/stores/playerStore'
import { useRoomStore } from '@/stores/roomStore'
import { useAuthSync } from './useAuthSync'
import { useRoomState } from './useRoomState'
import { OFFLINE_RESET_TIMEOUT_MS, useConnectionGuard } from './useConnectionGuard'

const fixture = vi.hoisted(() => ({
  socket: { id: 'fixture-socket', connected: false, on: vi.fn(), off: vi.fn(), emit: vi.fn() },
  cookies: [
    { platform: 'netease', cookie: 'fixture-netease' },
    { platform: 'tencent', cookie: 'fixture-tencent' },
  ],
  navigate: vi.fn(),
  toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn(), loading: vi.fn() },
}))
vi.mock('@/lib/hostRuntime', () => ({ hostRuntime: { kind: 'web', platformAccounts: true } }))
vi.mock('@/providers/SocketProvider', () => ({
  useSocketContext: () => ({ socket: fixture.socket, isConnected: true }),
}))
vi.mock('@/lib/storage', () => ({
  storage: {
    getUserId: () => 'fixture-user',
    getVolume: () => 0.8,
    getAudioLatencyOffsetMs: () => null,
    getAuthCookies: () => fixture.cookies,
    upsertAuthCookie: vi.fn(),
    setRejoinToken: vi.fn(),
    clearRejoinToken: vi.fn(),
  },
}))
vi.mock('@/stores/chatStore', () => ({ useChatStore: { getState: () => ({ reset: vi.fn() }) } }))
vi.mock('react-router', () => ({ useNavigate: () => fixture.navigate }))
vi.mock('sonner', () => ({ toast: fixture.toast }))

const room = (overrides: Partial<RoomState> = {}): RoomState => ({
  id: 'ABC123',
  name: 'Fixture',
  creatorId: 'fixture-user',
  hostId: 'fixture-user',
  conductorSocketId: 'fixture-socket',
  hasPassword: false,
  audioQuality: 128,
  queue: [],
  currentTrack: null,
  users: [{ id: 'fixture-user', nickname: 'Fixture', role: 'owner' }],
  playState: { isPlaying: false, currentTime: 0, serverTimestamp: 0, revision: 0 },
  playMode: 'sequential',
  queueMode: 'keep',
  ...overrides,
})

describe('automatic cookie restore on ROOM_STATE', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  let listeners: Map<string, Set<(...args: unknown[]) => void>>
  let unregisterStop: () => void
  const stopAudio = vi.fn()

  const cookieEmits = () => fixture.socket.emit.mock.calls.filter(([event]) => event === EVENTS.AUTH_SET_COOKIE)
  async function fire(event: string, ...args: unknown[]) {
    await act(async () => {
      for (const listener of [...(listeners.get(event) ?? [])]) listener(...args)
    })
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    authAutoResend.reset()
    listeners = new Map()
    fixture.socket.on.mockImplementation((event: string, listener: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event)!.add(listener)
    })
    fixture.socket.off.mockImplementation((event: string, listener: (...args: unknown[]) => void) =>
      listeners.get(event)?.delete(listener),
    )
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    useRoomStore.getState().reset()
    usePlayerStore.getState().reset()
    unregisterStop = registerActivePlaybackStop(stopAudio)
    container = document.createElement('div')
    root = createRoot(container)
    function Harness() {
      useAuthSync()
      useRoomState()
      useConnectionGuard()
      return null
    }
    await act(async () => root.render(<Harness />))
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    unregisterStop()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('resends the stored cookies for the first ROOM_STATE of a join, but not for later broadcasts', async () => {
    await fire(EVENTS.ROOM_STATE, room())
    expect(cookieEmits()).toEqual([
      [EVENTS.AUTH_SET_COOKIE, fixture.cookies[0]],
      [EVENTS.AUTH_SET_COOKIE, fixture.cookies[1]],
    ])

    // Someone joined / the mode changed: the server rebroadcasts the same room.
    await fire(EVENTS.ROOM_STATE, room({ queueMode: 'consume' as RoomState['queueMode'] }))
    await fire(EVENTS.ROOM_STATE, room({ users: [...room().users, { id: 'other', nickname: 'Other', role: 'member' }] }))
    expect(cookieEmits()).toHaveLength(2)
  })

  it('resends again after a disconnect and rejoin, and when entering a different room', async () => {
    await fire(EVENTS.ROOM_STATE, room())
    expect(cookieEmits()).toHaveLength(2)

    await fire('disconnect')
    expect(useRoomStore.getState()).toMatchObject({ connectionStatus: 'reconnecting', room: { id: 'ABC123' } })
    await fire(EVENTS.ROOM_STATE, room())
    expect(useRoomStore.getState().connectionStatus).toBe('connected')
    expect(cookieEmits()).toHaveLength(4)

    await fire(EVENTS.ROOM_STATE, room({ id: 'OTHER1' }))
    expect(cookieEmits()).toHaveLength(6)
  })

  it('keeps audio playing during the outage and stops it after 60 seconds without room confirmation', async () => {
    vi.useFakeTimers()
    await fire(EVENTS.ROOM_STATE, room())
    usePlayerStore.getState().setIsPlaying(true)
    const cancelPlay = vi.fn()
    const unregister = registerPendingPlayCancel(cancelPlay)
    try {
      await fire('disconnect')
      expect(cancelPlay).toHaveBeenCalledOnce()
      act(() => vi.advanceTimersByTime(59_999))
      expect(usePlayerStore.getState().isPlaying).toBe(true)
      expect(stopAudio).not.toHaveBeenCalled()
      act(() => vi.advanceTimersByTime(1))
      expect(stopAudio).toHaveBeenCalledOnce()
      expect(usePlayerStore.getState().isPlaying).toBe(false)
      expect(useRoomStore.getState().room).toBeNull()
    } finally {
      unregister()
    }
  })

  it('clears the offline reset timer when the same room confirms re-entry', async () => {
    vi.useFakeTimers()
    await fire(EVENTS.ROOM_STATE, room())
    await fire('disconnect')
    await fire(EVENTS.ROOM_STATE, room())
    act(() => vi.advanceTimersByTime(OFFLINE_RESET_TIMEOUT_MS))
    expect(stopAudio).not.toHaveBeenCalled()
    expect(useRoomStore.getState()).toMatchObject({ connectionStatus: 'connected', room: { id: 'ABC123' } })
  })

  it.each([
    [ERROR_CODE.ROOM_NOT_FOUND, '服务已更新，房间未能恢复'],
    [ERROR_CODE.JOIN_FAILED, 'Could not restore room'],
  ])('stops audio, resets the room, and returns home on %s during reconnect', async (code, message) => {
    await fire(EVENTS.ROOM_STATE, room())
    usePlayerStore.getState().setIsPlaying(true)
    await fire('disconnect')
    await fire(EVENTS.ROOM_ERROR, { code, message: 'Could not restore room' })
    expect(stopAudio).toHaveBeenCalledOnce()
    expect(usePlayerStore.getState().isPlaying).toBe(false)
    expect(useRoomStore.getState().room).toBeNull()
    expect(fixture.toast.error).toHaveBeenCalledWith(message)
    expect(fixture.navigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('keeps the silent-restore bookkeeping intact across broadcasts so a later manual login still toasts', async () => {
    await fire(EVENTS.ROOM_STATE, room())
    // A broadcast must not re-arm (or inflate) the number of expected silent results.
    await fire(EVENTS.ROOM_STATE, room({ queueMode: 'consume' as RoomState['queueMode'] }))

    await fire(EVENTS.AUTH_SET_COOKIE_RESULT, { success: true, message: 'restored 1', platform: 'netease', cookie: 'a' })
    await fire(EVENTS.AUTH_SET_COOKIE_RESULT, { success: true, message: 'restored 2', platform: 'tencent', cookie: 'b' })
    expect(fixture.toast.success).not.toHaveBeenCalled()

    await fire(EVENTS.AUTH_SET_COOKIE_RESULT, { success: true, message: 'manual login', platform: 'netease', cookie: 'c' })
    expect(fixture.toast.success).toHaveBeenCalledExactlyOnceWith('manual login')
  })
})
