import { usePlayerStore } from '@/stores/playerStore'
import type { LyricPlayerBase } from '@applemusic-like-lyrics/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { lyricPlayerBridge } from './lyricPlayerBridge'

function playerMock() {
  return {
    setCurrentTime: vi.fn(),
    resetScroll: vi.fn(),
    calcLayout: vi.fn(),
  }
}

describe('lyricPlayerBridge', () => {
  afterEach(() => usePlayerStore.getState().reset())

  it('syncs on attach and follows position changes while paused until detached', () => {
    const player = playerMock()
    usePlayerStore.setState({ currentTime: 12.3456, isPlaying: false })

    const detach = lyricPlayerBridge.attach(player as unknown as LyricPlayerBase)
    expect(player.setCurrentTime).toHaveBeenLastCalledWith(12346, true)
    usePlayerStore.setState({ currentTime: 17 })
    expect(player.setCurrentTime).toHaveBeenLastCalledWith(17000, true)

    detach()
    usePlayerStore.setState({ currentTime: 20 })
    expect(player.setCurrentTime).toHaveBeenCalledTimes(2)
  })

  it('updates the official AMLL player directly', () => {
    const player = playerMock()
    const detach = lyricPlayerBridge.attach(player as unknown as LyricPlayerBase)

    lyricPlayerBridge.setCurrentTime(12.345)

    expect(player.setCurrentTime).toHaveBeenCalledWith(12345, false)
    detach()
  })

  it('recalculates layout with the seek reason after updating time', () => {
    const player = playerMock()
    const detach = lyricPlayerBridge.attach(player as unknown as LyricPlayerBase)

    player.setCurrentTime.mockClear()
    lyricPlayerBridge.seek(42)

    expect(player.resetScroll).toHaveBeenCalledOnce()
    expect(player.setCurrentTime).toHaveBeenCalledWith(42000, true)
    expect(player.calcLayout).toHaveBeenCalledExactlyOnceWith('seek')
    expect(player.resetScroll).toHaveBeenCalledBefore(player.setCurrentTime)
    expect(player.setCurrentTime).toHaveBeenCalledBefore(player.calcLayout)
    detach()
  })
})
