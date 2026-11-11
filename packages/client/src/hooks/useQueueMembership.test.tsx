// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoomState, Track } from '@music-together/shared'

const toast = vi.hoisted(() => ({ info: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

import { useRoomStore } from '@/stores/roomStore'
import { useQueueMembership } from './useQueueMembership'

const track = (id: string): Track => ({
  id: `t-${id}`,
  title: `Song ${id}`,
  artist: ['A'],
  album: 'B',
  duration: 1,
  cover: '',
  source: 'netease',
  sourceId: id,
  urlId: id,
})
const setQueue = (...ids: string[]) =>
  act(() => useRoomStore.setState({ room: { id: 'R', queue: ids.map(track) } as unknown as RoomState }))

let latest: ReturnType<typeof useQueueMembership>
let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
function Probe() {
  const value = useQueueMembership()
  useEffect(() => {
    latest = value
  })
  return null
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  toast.info.mockReset()
  useRoomStore.setState({ room: { id: 'R', queue: [] } as unknown as RoomState })
  container = document.createElement('div')
  root = createRoot(container)
  act(() => root.render(<Probe />))
})
afterEach(() => {
  act(() => root.unmount())
  useRoomStore.getState().reset()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useQueueMembership', () => {
  it('counts a song just sent as added at once, and sends it only once', () => {
    const send = vi.fn()
    act(() => latest.addOnce(track('1'), send))
    expect(latest.isAdded(track('1'))).toBe(true)
    act(() => latest.addOnce(track('1'), send))
    expect(send).toHaveBeenCalledOnce()
    expect(toast.info).toHaveBeenCalledWith('「Song 1」已在队列中')
  })

  it('lets the queue decide once the song reached it: removing it makes it addable again', () => {
    act(() => latest.addOnce(track('1'), vi.fn()))
    setQueue('1')
    expect(latest.isAdded(track('1'))).toBe(true)
    setQueue()
    expect(latest.isAdded(track('1'))).toBe(false)
  })

  it('stops counting a song the server never queued', () => {
    act(() => latest.addOnce(track('1'), vi.fn()))
    expect(latest.isAdded(track('1'))).toBe(true)
    act(() => void vi.advanceTimersByTime(5_000))
    expect(latest.isAdded(track('1'))).toBe(false)
  })

  it('knows the songs already in the queue, and marks a whole batch', () => {
    setQueue('2')
    expect(latest.isAdded(track('2'))).toBe(true)
    act(() => latest.markPending([track('3'), track('4')]))
    expect([track('3'), track('4'), track('5')].map(latest.isAdded)).toEqual([true, true, false])
    expect(latest.queue.map((t) => t.sourceId)).toEqual(['2'])
  })
})
