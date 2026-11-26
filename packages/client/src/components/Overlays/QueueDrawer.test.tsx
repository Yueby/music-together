// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import type { RoomState, Track } from '@music-together/shared'

const dndState = vi.hoisted(() => ({
  onDragStart: undefined as ((event: DragStartEvent) => void) | undefined,
  onDragEnd: undefined as ((event: DragEndEvent) => void) | undefined,
  onDragCancel: undefined as (() => void) | undefined,
  rangeExtractor: undefined as
    | ((range: { startIndex: number; endIndex: number; overscan: number; count: number }) => number[])
    | undefined,
}))

const socketMock = vi.hoisted(() => ({
  id: 'socket-1',
  connected: true,
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
}))

vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual<typeof import('@dnd-kit/core')>('@dnd-kit/core')
  return {
    ...actual,
    DndContext: (props: Parameters<typeof actual.DndContext>[0]) => {
      dndState.onDragStart = props.onDragStart
      dndState.onDragEnd = props.onDragEnd
      dndState.onDragCancel = props.onDragCancel as (() => void) | undefined
      return <actual.DndContext {...props} />
    },
    DragOverlay: ({ children }: { children?: ReactNode }) => <div data-testid="dnd-overlay-portal">{children}</div>,
  }
})

vi.mock('@tanstack/react-virtual', () => ({
  defaultRangeExtractor: (range: { startIndex: number; endIndex: number; overscan: number; count: number }) => {
    const start = Math.max(range.startIndex - range.overscan, 0)
    const end = Math.min(range.endIndex + range.overscan, range.count - 1)
    const out: number[] = []
    for (let i = start; i <= end; i++) out.push(i)
    return out
  },
  useVirtualizer: ({
    count,
    estimateSize,
    rangeExtractor,
  }: {
    count: number
    estimateSize: () => number
    rangeExtractor?: (range: { startIndex: number; endIndex: number; overscan: number; count: number }) => number[]
  }) => {
    dndState.rangeExtractor = rangeExtractor
    const size = estimateSize()
    return {
      getTotalSize: () => count * size,
      getVirtualItems: () =>
        Array.from({ length: count }, (_, index) => ({
          index,
          key: index,
          start: index * size,
          size,
        })),
    }
  },
}))

vi.mock('@/components/ui/drawer', () => ({
  Drawer: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div role="dialog">{children}</div> : null),
  DrawerContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <span className="sr-only">{children}</span>,
}))

vi.mock('@/components/ArtworkImage', () => ({
  ArtworkImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

vi.mock('@/components/ArtistNames', () => ({
  ArtistNames: ({ track }: { track: Track }) => <span>{track.artist}</span>,
}))

vi.mock('@/components/ui/marquee-text', () => ({
  MarqueeText: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }))
vi.mock('@/hooks/useHasHover', () => ({ useHasHover: () => true }))
vi.mock('@/providers/SocketProvider', () => ({
  useSocketContext: () => ({ socket: socketMock, isConnected: true }),
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { storage } from '@/lib/storage'
import { AbilityProvider } from '@/providers/AbilityProvider'
import { usePlayerStore } from '@/stores/playerStore'
import { useRoomStore } from '@/stores/roomStore'
import { QueueDrawer } from './QueueDrawer'

function makeTrack(id: string, title: string): Track {
  return {
    id,
    title,
    artist: [`Artist ${id}`],
    album: `Album ${id}`,
    cover: '',
    duration: 210,
    source: 'netease',
    sourceId: id,
    urlId: id,
  }
}

function setRoomState(queue: Track[], role: 'owner' | 'admin' | 'member' = 'owner') {
  const userId = storage.getUserId()
  const user = { id: userId, nickname: 'Host', role }
  const room = {
    id: 'room-1',
    name: 'Test Room',
    ownerId: userId,
    users: [user],
    queue,
    currentTrack: queue[0] ?? null,
    playState: { isPlaying: false, currentTime: 0, serverTimestamp: 0, revision: 0 },
    playMode: 'sequential',
    queueMode: 'keep',
    hasPassword: false,
    maxUsers: 10,
    createdAt: 0,
  } as unknown as RoomState

  useRoomStore.getState().setRoom(room)
  usePlayerStore.getState().setCurrentTrack(queue[0] ?? null)
}

describe('QueueDrawer', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  let onOpenChange: ReturnType<typeof vi.fn<(open: boolean) => void>>
  let onRemoveFromQueue: ReturnType<typeof vi.fn<(trackId: string) => void>>
  let onReorderQueue: ReturnType<typeof vi.fn<(trackIds: string[]) => void>>
  let onClearQueue: ReturnType<typeof vi.fn<() => void>>

  const renderDrawer = () => {
    act(() => {
      root.render(
        <AbilityProvider>
          <QueueDrawer
            open
            onOpenChange={onOpenChange}
            onRemoveFromQueue={onRemoveFromQueue}
            onReorderQueue={onReorderQueue}
            onClearQueue={onClearQueue}
          />
        </AbilityProvider>,
      )
    })
  }

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.clearAllMocks()
    dndState.onDragStart = undefined
    dndState.onDragEnd = undefined
    dndState.onDragCancel = undefined
    dndState.rangeExtractor = undefined
    useRoomStore.getState().reset()
    usePlayerStore.getState().reset()

    onOpenChange = vi.fn()
    onRemoveFromQueue = vi.fn()
    onReorderQueue = vi.fn()
    onClearQueue = vi.fn()

    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    useRoomStore.getState().reset()
    usePlayerStore.getState().reset()
    vi.unstubAllGlobals()
  })

  it('renders drag handles when canReorder is true and queue has more than 1 track', () => {
    setRoomState([makeTrack('t1', 'First Song'), makeTrack('t2', 'Second Song')], 'owner')
    renderDrawer()

    const firstHandle = container.querySelector('button[aria-label="拖动排序 First Song"]')
    const secondHandle = container.querySelector('button[aria-label="拖动排序 Second Song"]')
    expect(firstHandle).not.toBeNull()
    expect(secondHandle).not.toBeNull()
    expect(firstHandle?.className).toContain('touch-none')
  })

  it('hides drag handles when canReorder is false', () => {
    setRoomState([makeTrack('t1', 'First Song'), makeTrack('t2', 'Second Song')], 'member')
    renderDrawer()

    expect(container.querySelector('button[aria-label^="拖动排序"]')).toBeNull()
  })

  it('hides drag handles when queue has 1 or fewer tracks', () => {
    setRoomState([makeTrack('t1', 'Solo Song')], 'owner')
    renderDrawer()

    expect(container.querySelector('button[aria-label^="拖动排序"]')).toBeNull()
  })

  it('reorders the queue on drag-end with the expected track ID array', () => {
    setRoomState(
      [makeTrack('t1', 'Song A'), makeTrack('t2', 'Song B'), makeTrack('t3', 'Song C')],
      'owner',
    )
    renderDrawer()

    expect(dndState.onDragEnd).toBeTypeOf('function')

    act(() => {
      dndState.onDragEnd?.({
        active: { id: 't3' },
        over: { id: 't1' },
      } as unknown as DragEndEvent)
    })

    expect(onReorderQueue).toHaveBeenCalledExactlyOnceWith(['t3', 't1', 't2'])
  })

  it('ignores drag-end when dropped on itself or outside any target', () => {
    setRoomState([makeTrack('t1', 'Song A'), makeTrack('t2', 'Song B')], 'owner')
    renderDrawer()

    act(() => {
      dndState.onDragEnd?.({
        active: { id: 't1' },
        over: { id: 't1' },
      } as unknown as DragEndEvent)
      dndState.onDragEnd?.({
        active: { id: 't1' },
        over: null,
      } as unknown as DragEndEvent)
    })

    expect(onReorderQueue).not.toHaveBeenCalled()
  })

  it('preserves existing move up/down, pin-to-top, and remove actions', () => {
    setRoomState(
      [makeTrack('t1', 'Song A'), makeTrack('t2', 'Song B'), makeTrack('t3', 'Song C')],
      'owner',
    )
    renderDrawer()

    const moveUpBtn = container.querySelector<HTMLButtonElement>('button[aria-label="上移 Song B"]')
    const moveDownBtn = container.querySelector<HTMLButtonElement>('button[aria-label="下移 Song B"]')
    const pinBtn = container.querySelector<HTMLButtonElement>('button[aria-label="置顶 Song C"]')
    const removeBtn = container.querySelector<HTMLButtonElement>('button[aria-label="移除 Song B"]')

    expect(moveUpBtn).not.toBeNull()
    expect(moveDownBtn).not.toBeNull()
    expect(pinBtn).not.toBeNull()
    expect(removeBtn).not.toBeNull()

    act(() => moveUpBtn!.click())
    expect(onReorderQueue).toHaveBeenLastCalledWith(['t2', 't1', 't3'])

    act(() => moveDownBtn!.click())
    expect(onReorderQueue).toHaveBeenLastCalledWith(['t1', 't3', 't2'])

    act(() => pinBtn!.click())
    expect(onReorderQueue).toHaveBeenLastCalledWith(['t1', 't3', 't2'])

    act(() => removeBtn!.click())
    expect(onRemoveFromQueue).toHaveBeenCalledExactlyOnceWith('t2')
  })

  it('keeps the actively dragged row in virtualizer rangeExtractor and renders DragOverlay', () => {
    const tracks = Array.from({ length: 20 }, (_, i) => makeTrack(`t${i}`, `Song ${i}`))
    setRoomState(tracks, 'owner')
    renderDrawer()

    act(() => {
      dndState.onDragStart?.({ active: { id: 't1' } } as unknown as DragStartEvent)
    })

    // Viewport scrolled far down (indices 10..15) — index 1 must stay mounted while dragging
    const indices = dndState.rangeExtractor?.({ startIndex: 12, endIndex: 15, overscan: 2, count: 20 })
    expect(indices).toContain(1)
    // Overlay must be portaled to document.body (outside drawer content) so Vaul's `will-change: transform` cannot offset it
    const overlay = document.body.querySelector('[data-testid="queue-drag-overlay"]')
    expect(overlay?.textContent).toContain('Song 1')
    expect(container.querySelector('[data-testid="queue-drag-overlay"]')).toBeNull()

    act(() => {
      dndState.onDragCancel?.()
    })
    expect(document.body.querySelector('[data-testid="queue-drag-overlay"]')).toBeNull()
  })
})
