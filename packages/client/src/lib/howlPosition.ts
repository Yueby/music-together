import type { PlaybackSound } from './PlaybackSound'

/**
 * Seek a playback sound to a non-negative target position.
 * Native HTMLAudioSound updates `currentTime` directly without pausing or restarting playback.
 */
export function setHowlPosition(howl: Pick<PlaybackSound, 'playing' | 'seek'>, targetTime: number, soundId?: number): void {
  const safeTarget = Math.max(0, targetTime)
  if (soundId === undefined) howl.seek(safeTarget)
  else howl.seek(safeTarget, soundId)
}
