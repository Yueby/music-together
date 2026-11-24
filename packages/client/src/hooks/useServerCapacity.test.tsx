// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EVENTS, type ServerCapacityStatus } from '@music-together/shared'
import { useServerStatusStore } from '@/stores/serverStatusStore'
import { ServerCapacitySync } from './useServerCapacity'

const { runtime, socket, info } = vi.hoisted(() => ({
  runtime: { kind: 'web' },
  socket: { connected: false, on: vi.fn(), off: vi.fn() },
  info: vi.fn(),
}))
vi.mock('@/lib/hostRuntime', () => ({ hostRuntime: runtime }))
vi.mock('@/providers/SocketProvider', () => ({ useSocketContext: () => ({ socket }) }))
vi.mock('sonner', () => ({ toast: { info } }))

afterEach(() => {
  cleanup()
  useServerStatusStore.getState().reset()
  vi.clearAllMocks()
})

describe('ServerCapacitySync', () => {
  it('keeps a room switch queued when the current room broadcasts its state', () => {
    render(<ServerCapacitySync />)
    const onRoomState = socket.on.mock.calls.find(([event]) => event === EVENTS.ROOM_STATE)![1]
    useServerStatusStore.getState().setAdmissionQueue({
      action: 'join', roomId: 'target', position: 1, queueLength: 1, reason: 'mapp_room',
      capacity: {} as ServerCapacityStatus,
    })
    act(() => onRoomState({ id: 'current' }))
    expect(useServerStatusStore.getState().admissionQueue?.roomId).toBe('target')
    act(() => onRoomState({ id: 'target' }))
    expect(useServerStatusStore.getState().admissionQueue).toBeNull()
  })

  it.each(['web', 'mapp'])('clears the queue on disconnect and informs queued mini-app users (%s)', (kind) => {
    runtime.kind = kind
    render(<ServerCapacitySync />)
    const onQueued = socket.on.mock.calls.find(([event]) => event === EVENTS.ADMISSION_QUEUED)![1]
    const onDisconnect = socket.on.mock.calls.find(([event]) => event === 'disconnect')![1]
    act(() => onQueued({ action: 'join', position: 1, queueLength: 1, reason: 'capacity', capacity: {} as ServerCapacityStatus }))
    expect(useServerStatusStore.getState().admissionQueue).not.toBeNull()

    act(() => onDisconnect())
    expect(useServerStatusStore.getState().admissionQueue).toBeNull()
    if (kind === 'mapp') expect(info).toHaveBeenCalledExactlyOnceWith('连接已断开，排队已取消，重连后请重新进入')
    else expect(info).not.toHaveBeenCalled()
  })
})
