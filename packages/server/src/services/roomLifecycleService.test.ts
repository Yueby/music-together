import { afterEach, describe, expect, it, vi } from 'vitest'
import { config } from '../config.js'
import { roomRepo } from '../repositories/roomRepository.js'
import { clearAllTimers, scheduleDeletion } from './roomLifecycleService.js'
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
})
