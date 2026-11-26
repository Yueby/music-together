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
    // 房间名 / 房间号 / 音质 / 队列模式 / 密码保护 / 昵称，每行标签下都有一行说明
    expect(labels.length).toBeGreaterThanOrEqual(6)
    expect(labels).not.toContain('同步偏移')
    expect(hints()).toHaveLength(labels.length)
  })
})

describe('RoomSettingsSection accessibility & touch targets', () => {
  it('labels save/cancel room name buttons with mobile-friendly touch targets', () => {
    show('owner', 'keep')
    const editBtn = container.querySelector<HTMLButtonElement>('button[aria-label="编辑房间名"]')
    expect(editBtn).not.toBeNull()
    expect(editBtn?.className).toContain('min-h-11')
    expect(editBtn?.className).toContain('min-w-11')

    act(() => editBtn!.click())

    const saveBtn = container.querySelector<HTMLButtonElement>('button[aria-label="保存房间名称"]')
    const cancelBtn = container.querySelector<HTMLButtonElement>('button[aria-label="取消编辑"]')
    expect(saveBtn).not.toBeNull()
    expect(cancelBtn).not.toBeNull()
    expect(saveBtn?.className).toContain('min-h-11')
    expect(cancelBtn?.className).toContain('min-h-11')

    act(() => cancelBtn!.click())
    expect(container.querySelector('button[aria-label="保存房间名称"]')).toBeNull()
  })

  it('renders the copyable room password as a keyboard-accessible button', () => {
    const room = {
      id: 'ROOM01',
      name: 'Room',
      creatorId: 'me',
      hostId: 'me',
      hasPassword: true,
      audioQuality: 320,
      queue: [],
      currentTrack: null,
      users: [{ id: 'me', nickname: 'Me', role: 'owner' }],
      playState: { isPlaying: false, currentTime: 0, serverTimestamp: 0, revision: 0 },
      playMode: 'loop-all',
      queueMode: 'keep',
    } as unknown as RoomState
    useRoomStore.setState({ room, currentUser: room.users[0], roomPassword: 'secret-pass' })
    act(() =>
      root.render(
        <TooltipProvider>
          <RoomSettingsSection onUpdateSettings={vi.fn()} />
        </TooltipProvider>,
      ),
    )

    const copyBtn = container.querySelector<HTMLButtonElement>('button[type="button"][aria-label="复制房间密码"]')
    expect(copyBtn).not.toBeNull()
    expect(copyBtn?.textContent).toContain('secret-pass')
  })
})
