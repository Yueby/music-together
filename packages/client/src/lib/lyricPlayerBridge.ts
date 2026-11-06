import type { LyricPlayerBase } from '@applemusic-like-lyrics/core'

let player: LyricPlayerBase | null = null

export const lyricPlayerBridge = {
  attach(nextPlayer: LyricPlayerBase): () => void {
    player = nextPlayer
    return () => {
      if (player === nextPlayer) player = null
    }
  },

  setCurrentTime(timeSeconds: number, isSeeking = false): void {
    player?.setCurrentTime(Math.round(timeSeconds * 1000), isSeeking)
  },

  seek(timeSeconds: number): void {
    if (!player) return
    player.resetScroll()
    player.setCurrentTime(Math.round(timeSeconds * 1000), true)
    player.calcLayout('seek')
  },
}
