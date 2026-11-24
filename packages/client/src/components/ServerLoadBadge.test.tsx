// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServerCapacityStatus } from '@music-together/shared'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useRoomStore } from '@/stores/roomStore'
import { useServerStatusStore } from '@/stores/serverStatusStore'
import { RoomHeader } from '@/components/Room/RoomHeader'
import { getEffectiveServerLoad, ServerLoadBadge } from './ServerLoadBadge'

const socketFixture = vi.hoisted(() => ({
  isConnected: true,
}))

const runtimeFixture = vi.hoisted(() => ({ kind: 'web' as 'web' | 'mapp' }))

vi.mock('@/lib/hostRuntime', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/hostRuntime')>()
  return {
    ...original,
    hostRuntime: { ...original.hostRuntime, get kind() { return runtimeFixture.kind } },
  }
})

vi.mock('@/providers/SocketProvider', () => ({
  useSocketContext: () => ({ isConnected: socketFixture.isConnected }),
}))

const baseCapacity: ServerCapacityStatus = {
  level: 'normal',
  mappLevel: 'normal',
  onlineUsers: 14,
  activeRooms: 3,
  usedUnits: 18,
  effectiveCap: 105,
  estimatedWebRemaining: 87,
  estimatedMappRemaining: 29,
  queueLength: 0,
  maxQueueLength: 100,
  pressurePercent: 17,
  mappPressurePercent: 20,
  mappRoomLimit: 16,
  createRestricted: false,
  updatedAt: 1_000,
}

function mockMatchMedia(hasHover: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: hasHover && (query === '(hover: hover)' || query === '(any-hover: hover)'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
}

const CJK_RE = /[\u4e00-\u9fff]/

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  mockMatchMedia(false)
  socketFixture.isConnected = true
  runtimeFixture.kind = 'web'
  useServerStatusStore.getState().reset()
  useRoomStore.getState().reset()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  useServerStatusStore.getState().reset()
  useRoomStore.getState().reset()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('ServerLoadBadge', () => {
  it('uses the load percentage of the current host runtime', () => {
    const capacity = { ...baseCapacity, mappLevel: 'full' as const, mappPressurePercent: 91 }
    expect(getEffectiveServerLoad(capacity)).toMatchObject({ level: 'normal', pct: 17 })
    runtimeFixture.kind = 'mapp'
    expect(getEffectiveServerLoad(capacity)).toMatchObject({ level: 'full', pct: 91 })
  })

  it('refreshes queued capacity snapshot when live capacity updates arrive', () => {
    const store = useServerStatusStore.getState()
    store.setAdmissionQueue({
      position: 2,
      queueLength: 5,
      action: 'join',
      roomId: 'ROOM01',
      reason: 'mapp_room',
      capacity: baseCapacity,
    })
    const updated = { ...baseCapacity, mappPressurePercent: 88, mappRoomLimit: 14, updatedAt: 2_000 }
    store.setCapacity(updated)
    expect(useServerStatusStore.getState().admissionQueue?.capacity).toEqual(updated)
    expect(useServerStatusStore.getState().admissionQueue?.position).toBe(2)
  })

  it('renders nothing before the first server capacity snapshot arrives', () => {
    act(() => root.render(<ServerLoadBadge />))
    expect(container.querySelector('[data-testid="server-load-badge"]')).toBeNull()
  })

  it('renders borderless inline trigger with online count and queue info without font-mono on Chinese text', () => {
    useServerStatusStore.getState().setCapacity({ ...baseCapacity, level: 'busy', queueLength: 4 })
    act(() => root.render(<ServerLoadBadge />))
    const badge = container.querySelector('[data-testid="server-load-badge"]')
    expect(badge).not.toBeNull()
    expect(badge?.getAttribute('data-load-level')).toBe('busy')
    expect(badge?.textContent).toContain('繁忙')
    expect(badge?.textContent).toContain('14 人')
    expect(badge?.textContent).toContain('排队 4')
    expect(badge?.querySelector('.border')).toBeNull()
    expect(badge?.querySelector('.animate-ping')).toBeNull()

    for (const el of badge?.querySelectorAll('.font-mono') ?? []) {
      expect(CJK_RE.test(el.textContent ?? '')).toBe(false)
    }
  })

  it('shows inline online suffix when queue is empty', () => {
    useServerStatusStore.getState().setCapacity(baseCapacity)
    act(() => root.render(<ServerLoadBadge />))
    const badge = container.querySelector('[data-testid="server-load-badge"]')
    expect(badge?.getAttribute('data-load-level')).toBe('normal')
    expect(badge?.textContent).toContain('流畅')
    expect(badge?.textContent).toContain('14 人在线')
  })

  it('opens a touch-accessible popover with capacity breakdown on click', () => {
    useServerStatusStore.getState().setCapacity({
      ...baseCapacity,
      level: 'busy',
      pressurePercent: 74,
      onlineUsers: 42,
      activeRooms: 6,
      estimatedWebRemaining: 18,
      queueLength: 2,
      createRestricted: true,
    })
    act(() => root.render(<ServerLoadBadge />))

    const badge = container.querySelector<HTMLButtonElement>('[data-testid="server-load-badge"]')
    expect(badge).not.toBeNull()
    expect(document.body.querySelector('[data-slot="popover-content"]')).toBeNull()

    act(() => badge!.click())

    const popover = document.body.querySelector('[data-slot="popover-content"]')
    expect(popover).not.toBeNull()
    const text = popover?.textContent ?? ''
    expect(text).toContain('服务器繁忙')
    expect(text).toContain('74%')
    expect(text).toContain('42 人')
    expect(text).toContain('6 个')
    expect(text).toContain('预计还可加入约 18 人')
    expect(text).toContain('当前有 2 人正在排队')
    expect(text).toContain('高负载保护中：暂限新建房间，可加入现有房间')
    expect(popover?.querySelectorAll('[data-slot="separator"]').length).toBeGreaterThanOrEqual(1)
    for (const el of popover?.querySelectorAll('.font-mono') ?? []) {
      expect(CJK_RE.test(el.textContent ?? '')).toBe(false)
    }

    act(() => badge!.click())
    expect(document.body.querySelector('[data-slot="popover-content"]')).toBeNull()
  })

  it('supports hover preview only when useHasHover() is true', () => {
    vi.useFakeTimers()
    mockMatchMedia(true)
    useServerStatusStore.getState().setCapacity(baseCapacity)
    act(() => root.render(<ServerLoadBadge />))

    const badge = container.querySelector<HTMLButtonElement>('[data-testid="server-load-badge"]')
    expect(badge).not.toBeNull()

    act(() => {
      badge!.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }))
      vi.advanceTimersByTime(200)
    })
    expect(document.body.querySelector('[data-slot="popover-content"]')).not.toBeNull()

    act(() => {
      badge!.dispatchEvent(new MouseEvent('pointerout', { bubbles: true }))
      vi.advanceTimersByTime(200)
    })
    expect(document.body.querySelector('[data-slot="popover-content"]')).toBeNull()
  })
})

describe('RoomHeader fused connection & server status', () => {
  function renderRoomHeader() {
    act(() =>
      root.render(
        <TooltipProvider>
          <RoomHeader
            onOpenSearch={vi.fn()}
            onOpenSettings={vi.fn()}
            onOpenAccount={vi.fn()}
            onOpenMembers={vi.fn()}
            onLeaveRoom={vi.fn()}
          />
        </TooltipProvider>,
      ),
    )
  }

  it('fuses server load into the connection indicator without adding a standalone badge', () => {
    useServerStatusStore.getState().setCapacity(baseCapacity)
    renderRoomHeader()

    expect(container.querySelector('[data-testid="server-load-badge"]')).toBeNull()
    const trigger = container.querySelector<HTMLButtonElement>('[data-testid="room-connection-status"]')
    expect(trigger).not.toBeNull()
    expect(trigger?.getAttribute('data-load-level')).toBe('normal')
    expect(container.querySelector('[data-testid="room-server-load-dot"]')).toBeNull()

    act(() => trigger!.click())
    const popover = document.body.querySelector('[data-slot="popover-content"]')
    expect(popover).not.toBeNull()
    const text = popover?.textContent ?? ''
    expect(text).toContain('已连接')
    expect(text).toContain('ms')
    expect(text).toContain('服务器流畅')
    expect(text).toContain('17%')
    expect(text).toContain('14 人')
    expect(text).toContain('3 个')
    for (const el of popover?.querySelectorAll('.font-mono') ?? []) {
      expect(CJK_RE.test(el.textContent ?? '')).toBe(false)
    }
  })

  it('shows a subtle semantic dot beside RTT only when server load is busy or full', () => {
    useServerStatusStore.getState().setCapacity({ ...baseCapacity, level: 'full', pressurePercent: 95 })
    renderRoomHeader()

    const trigger = container.querySelector<HTMLButtonElement>('[data-testid="room-connection-status"]')
    expect(trigger?.getAttribute('data-load-level')).toBe('full')
    expect(container.querySelector('[data-testid="room-server-load-dot"]')).not.toBeNull()
    expect(trigger?.querySelector('.animate-ping')).toBeNull()
  })
})
