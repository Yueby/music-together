import { isHtmlAudioPoolUnlocked, unlockHtmlAudioPool } from './htmlAudioSound'

export function isAudioUnlocked(): boolean {
  return isHtmlAudioPoolUnlocked()
}

/**
 * Call within a real user interaction (click / keydown / touchend).
 * Primes the pooled HTMLAudioElements so subsequent playback and song switches
 * work on mobile browsers without re-triggering autoplay restrictions.
 */
export async function unlockAudio(): Promise<void> {
  await unlockHtmlAudioPool()
}
