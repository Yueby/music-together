import type { LyricPlayerBase } from '@applemusic-like-lyrics/core'
import { describe, expect, it, vi } from 'vitest'
import { lyricPlayerBridge } from './lyricPlayerBridge'

function playerMock() {
  return {
    setCurrentTime: vi.fn(),
    resetScroll: vi.fn(),
    calcLayout: vi.fn(),
  }
}

describe('lyricPlayerBridge', () => {
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

    lyricPlayerBridge.seek(42)

    expect(player.resetScroll).toHaveBeenCalledOnce()
    expect(player.setCurrentTime).toHaveBeenCalledWith(42000, true)
    expect(player.calcLayout).toHaveBeenCalledExactlyOnceWith('seek')
    expect(player.resetScroll).toHaveBeenCalledBefore(player.setCurrentTime)
    expect(player.setCurrentTime).toHaveBeenCalledBefore(player.calcLayout)
    detach()
  })
})
