import type { LyricPlayerBase } from '@applemusic-like-lyrics/core'
import { usePlayerStore } from '@/stores/playerStore'

let player: LyricPlayerBase | null = null

export const lyricPlayerBridge = {
  attach(nextPlayer: LyricPlayerBase): () => void {
    player = nextPlayer
    nextPlayer.setCurrentTime(Math.round(usePlayerStore.getState().currentTime * 1000), true)
    // Paused loads can settle at a new position without starting the audio ticker.
    const unsubscribe = usePlayerStore.subscribe((state, previous) => {
      if (player === nextPlayer && !state.isPlaying && state.currentTime !== previous.currentTime) {
        nextPlayer.setCurrentTime(Math.round(state.currentTime * 1000), true)
      }
    })
    return () => {
      unsubscribe()
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
