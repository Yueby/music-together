import { afterEach, describe, expect, it, vi } from 'vitest'
import { config } from '../config.js'
import { roomRepo } from '../repositories/roomRepository.js'
import './playerService.js'
import { clearAllTimers, registerRoomCleanup, scheduleDeletion } from './roomLifecycleService.js'
import { createRoom } from './roomService.js'

describe('room deletion', () => {
  afterEach(() => {
    clearAllTimers()
    vi.useRealTimers()
  })

  it('clears pending playback while the room is still in the repository', () => {
    vi.useFakeTimers()
    const { room } = createRoom('owner-socket', 'Owner')
    room.users = []
    const onCommit = vi.fn()
    const delay = config.room.gracePeriodMs + 100
    room.pendingPlayback = {
      type: 'stop',
      track: null,
      playState: { ...room.playState, serverTimeToExecute: Date.now() + delay },
      timer: setTimeout(onCommit, delay),
    }

    scheduleDeletion(room.id)
    vi.advanceTimersByTime(config.room.gracePeriodMs)

    expect(roomRepo.get(room.id)).toBeUndefined()
    expect(room.pendingPlayback).toBeNull()
    vi.advanceTimersByTime(100)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('runs cleanup hooks before deletion and continues after a hook throws', () => {
    vi.useFakeTimers()
    const { room } = createRoom('owner-socket', 'Owner')
    room.users = []
    const removed = vi.fn()
    const unregisterRemoved = registerRoomCleanup('test-first', removed)
    const broken = vi.fn(() => {
      throw new Error('broken hook')
    })
    const unregisterBroken = registerRoomCleanup('test-first', broken)
    const subsequent = vi.fn((roomId: string) => roomRepo.get(roomId))
    const unregisterSubsequent = registerRoomCleanup('test-second', subsequent)
    unregisterRemoved()
    try {
      scheduleDeletion(room.id)
      vi.advanceTimersByTime(config.room.gracePeriodMs)

      expect(removed).not.toHaveBeenCalled()
      expect(broken).toHaveBeenCalledExactlyOnceWith(room.id)
      expect(subsequent).toHaveBeenCalledExactlyOnceWith(room.id)
      expect(subsequent).toHaveReturnedWith(room)
      expect(roomRepo.get(room.id)).toBeUndefined()
    } finally {
      unregisterBroken()
      unregisterSubsequent()
    }
  })
})
