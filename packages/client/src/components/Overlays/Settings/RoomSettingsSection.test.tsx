// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { QueueMode, RoomState, UserRole } from '@music-together/shared'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { TooltipProvider } from '@/components/ui/tooltip'
import { useRoomStore } from '@/stores/roomStore'
import { RoomSettingsSection } from './RoomSettingsSection'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
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

function show(role: UserRole, queueMode: QueueMode) {
  const room = {
    id: 'ROOM01',
    name: 'Room',
    creatorId: 'me',
    hostId: 'me',
    hasPassword: false,
    audioQuality: 320,
    queue: [],
    currentTrack: null,
    users: [{ id: 'me', nickname: 'Me', role }],
    playState: { isPlaying: false, currentTime: 0, serverTimestamp: 0, revision: 0 },
    playMode: 'loop-all',
    queueMode,
  } as unknown as RoomState
  useRoomStore.setState({ room, currentUser: room.users[0] })
  act(() =>
    root.render(
      <TooltipProvider>
        <RoomSettingsSection onUpdateSettings={vi.fn()} />
      </TooltipProvider>,
    ),
  )
}

const queueModeControl = () => container.querySelector('[role="combobox"][aria-label="队列模式"]')
/** 每个设置项标签下方的说明文字 */
const hints = () => Array.from(container.querySelectorAll('label + p')).map((p) => p.textContent)

describe('RoomSettingsSection queue mode', () => {
  it('lets the room owner see and change it, with what it does spelled out', () => {
    show('owner', 'keep')
    expect(queueModeControl()?.textContent).toContain('保留已播放')
    expect(hints().join('\n')).toContain('听完（或切走）的歌离开队列，不再循环')
  })

  it('shows the owner the mode that is set', () => {
    show('owner', 'consume')
    expect(queueModeControl()?.textContent).toContain('播完即移除')
  })

  it.each<UserRole>(['admin', 'member'])('only tells a %s which mode the room is in', (role) => {
    show(role, 'consume')
    expect(queueModeControl()).toBeNull()
    expect(container.textContent).toContain('播完即移除')
    expect(hints()).toContain('听完的歌会离开队列，不循环')
  })

  it('tells a member of a room that keeps its tracks that they stay in the queue', () => {
    show('member', 'keep')
    expect(queueModeControl()).toBeNull()
    expect(container.textContent).toContain('保留已播放')
    expect(hints()).toContain('听过的歌会保留在队列里，可循环播放；仅房主可切换')
    expect(hints().join('\n')).not.toContain('不循环')
  })

  it('explains every row of the room page, whoever is looking', () => {
    show('member', 'keep')
    const labels = Array.from(container.querySelectorAll('label')).map((l) => l.textContent)
    // 房间名 / 房间号 / 同步偏移 / 音质 / 队列模式 / 密码保护 / 昵称，每行标签下都有一行说明
    expect(labels.length).toBeGreaterThanOrEqual(7)
    expect(hints()).toHaveLength(labels.length)
  })
})
