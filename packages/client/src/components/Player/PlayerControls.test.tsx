// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { QueueMode, RoomState } from '@music-together/shared'

vi.mock('@/providers/SocketProvider', () => ({ useSocketContext: () => ({ socket: { emit: vi.fn() } }) }))
vi.mock('@/providers/AbilityProvider', () => ({ useAppAbility: () => ({ can: () => true }) }))

import { TooltipProvider } from '@/components/ui/tooltip'
import { useRoomStore } from '@/stores/roomStore'
import { PlayerControls } from './PlayerControls'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
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

function show(queueMode: QueueMode) {
  useRoomStore.setState({ room: { id: 'ROOM01', queue: [], queueMode, playMode: 'loop-all' } as unknown as RoomState })
  act(() =>
    root.render(
      <TooltipProvider>
        <PlayerControls
          onPlay={vi.fn()}
          onPause={vi.fn()}
          onSeek={vi.fn()}
          onNext={vi.fn()}
          onPrev={vi.fn()}
          onOpenQueue={vi.fn()}
          onStartVote={vi.fn()}
        />
      </TooltipProvider>,
    ),
  )
}

const button = (label: string) => container.querySelector(`button[aria-label="${label}"]`)

describe('PlayerControls "previous"', () => {
  it('is there in a room that keeps its queue', () => {
    show('keep')
    expect(button('上一首')).not.toBeNull()
    expect(button('下一首')).not.toBeNull()
  })

  it('is not offered in a consumed queue, where what was heard has left it', () => {
    show('consume')
    expect(button('上一首')).toBeNull()
    expect(button('下一首')).not.toBeNull()
    expect(button('播放')).not.toBeNull()
  })
})
