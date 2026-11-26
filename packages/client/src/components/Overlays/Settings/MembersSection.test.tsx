// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoomState } from '@music-together/shared'

import { useRoomStore } from '@/stores/roomStore'
import { MembersSection } from './MembersSection'

describe('MembersSection', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    useRoomStore.getState().reset()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    useRoomStore.getState().reset()
    vi.unstubAllGlobals()
  })

  it('omits the redundant static role badge when the host role selector is shown and truncates long nicknames', () => {
    const owner = { id: 'u1', nickname: 'RoomOwner', role: 'owner' as const }
    const member = { id: 'u2', nickname: 'VeryLongMemberNicknameThatShouldTruncateCleanly', role: 'member' as const }
    useRoomStore.setState({
      room: { id: 'ROOM01', users: [owner, member] } as unknown as RoomState,
      currentUser: owner,
    })

    act(() => {
      root.render(<MembersSection onSetUserRole={vi.fn()} />)
    })

    const rows = Array.from(container.querySelectorAll('div.flex.min-w-0.items-center'))
    expect(rows).toHaveLength(2)

    // Owner row: shows self badge + owner role badge, no role select
    expect(rows[0].textContent).toContain('RoomOwner')
    expect(rows[0].textContent).toContain('你')
    expect(rows[0].textContent).toContain('房主')
    expect(rows[0].querySelector('[role="combobox"]')).toBeNull()

    // Member row viewed by owner: shows role select instead of a duplicate static badge
    const nicknameSpan = rows[1].querySelector('span.truncate')
    expect(nicknameSpan?.className).toContain('min-w-0')
    expect(nicknameSpan?.className).toContain('flex-1')
    expect(rows[1].querySelector('[role="combobox"]')).not.toBeNull()
    expect(rows[1].querySelectorAll('[data-slot="badge"]')).toHaveLength(0)
  })

  it('shows static role badges for all users when a non-owner views members', () => {
    const owner = { id: 'u1', nickname: 'RoomOwner', role: 'owner' as const }
    const member = { id: 'u2', nickname: 'Listener', role: 'member' as const }
    useRoomStore.setState({
      room: { id: 'ROOM01', users: [owner, member] } as unknown as RoomState,
      currentUser: member,
    })

    act(() => {
      root.render(<MembersSection onSetUserRole={vi.fn()} />)
    })

    expect(container.querySelector('[role="combobox"]')).toBeNull()
    expect(container.textContent).toContain('房主')
    expect(container.textContent).toContain('成员')
  })
})
