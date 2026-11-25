// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoomState } from '@music-together/shared'

const clipboardState = vi.hoisted(() => ({
  available: true,
  copyText: vi.fn<(text: string) => Promise<boolean>>(async () => true),
}))

vi.mock('@/lib/clipboard', () => ({
  canCopyText: () => clipboardState.available,
  copyText: (text: string) => clipboardState.copyText(text),
  getRoomShareUrl: (roomId: string) => `https://example.test/room/${roomId}`,
}))

vi.mock('@/providers/SocketProvider', () => ({
  useSocketContext: () => ({ isConnected: true }),
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <span className="sr-only">{children}</span>,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
}))

import { useRoomStore } from '@/stores/roomStore'
import { RoomHeader } from './RoomHeader'

describe('RoomHeader room identity popover', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  const renderHeader = () => {
    act(() => {
      root.render(
        <RoomHeader
          onOpenSearch={vi.fn()}
          onOpenSettings={vi.fn()}
          onOpenAccount={vi.fn()}
          onOpenMembers={vi.fn()}
          onLeaveRoom={vi.fn()}
        />,
      )
    })
  }

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    clipboardState.available = true
    clipboardState.copyText.mockClear()
    useRoomStore.getState().setRoom({
      id: 'TX4YY6',
      name: '深夜听歌房',
      users: [{ id: 'u1', nickname: 'Host', role: 'owner' }],
      queue: [],
      currentTrack: null,
      playState: { isPlaying: false, currentTime: 0, serverTimestamp: 0, revision: 0 },
      playMode: 'sequential',
      queueMode: 'keep',
      hasPassword: true,
      maxUsers: 10,
      createdAt: 0,
    } as unknown as RoomState)

    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    document.body.innerHTML = ''
    useRoomStore.getState().reset()
    vi.unstubAllGlobals()
  })

  it('hides the room id in the header trigger by default and reveals it in the popover with copy actions', async () => {
    renderHeader()

    const trigger = container.querySelector<HTMLButtonElement>('[data-testid="room-identity-trigger"]')
    expect(trigger).not.toBeNull()
    expect(trigger?.textContent).toContain('深夜听歌房')
    expect(trigger?.textContent).not.toContain('TX4YY6')
    expect(document.body.querySelector('[data-testid="room-popover-id"]')).toBeNull()

    await act(async () => {
      trigger?.click()
    })

    const popoverId = document.body.querySelector('[data-testid="room-popover-id"]')
    expect(popoverId?.textContent).toBe('TX4YY6')

    const copyIdBtn = document.body.querySelector<HTMLButtonElement>('button[aria-label="复制房间号"]')
    const copyLinkBtn = document.body.querySelector<HTMLButtonElement>('button[aria-label="复制房间链接"]')
    expect(copyIdBtn).not.toBeNull()
    expect(copyLinkBtn).not.toBeNull()

    await act(async () => {
      copyIdBtn?.click()
    })
    expect(clipboardState.copyText).toHaveBeenLastCalledWith('TX4YY6')

    await act(async () => {
      copyLinkBtn?.click()
    })
    expect(clipboardState.copyText).toHaveBeenLastCalledWith('https://example.test/room/TX4YY6')
  })

  it('still reveals room id in the popover without copy buttons when clipboard is unavailable', async () => {
    clipboardState.available = false
    renderHeader()

    const trigger = container.querySelector<HTMLButtonElement>('[data-testid="room-identity-trigger"]')
    await act(async () => {
      trigger?.click()
    })

    expect(document.body.querySelector('[data-testid="room-popover-id"]')?.textContent).toBe('TX4YY6')
    expect(document.body.querySelector('button[aria-label="复制房间号"]')).toBeNull()
    expect(document.body.querySelector('button[aria-label="复制房间链接"]')).toBeNull()
  })
})
