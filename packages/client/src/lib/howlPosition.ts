import type { PlaybackSound } from './PlaybackSound'

interface Html5Sound {
  _id: number
  _node?: { currentTime: number }
  _seek?: number
  _rateSeek?: number
}

/**
 * Move a playing HTML5 Howl without Howler's pause→seek→play cycle.
 * That cycle can add hundreds of milliseconds on mobile and immediately
 * recreate the drift the correction is trying to remove.
 */
export function setHowlPosition(howl: Pick<PlaybackSound, 'playing' | 'seek'>, targetTime: number, soundId?: number): void {
  const safeTarget = Math.max(0, targetTime)
  const internal = howl as unknown as { _sounds?: Html5Sound[] }
  const sound = internal._sounds?.find((candidate) => soundId === undefined || candidate._id === soundId)

  if (howl.playing(soundId) && sound?._node && Number.isFinite(sound._node.currentTime)) {
    try {
      sound._node.currentTime = safeTarget
      sound._seek = safeTarget
      // Howler's HTML5 seek getter reads node.currentTime directly, but rate()
      // also tracks an internal seek anchor. Keep it aligned with our direct
      // media-element update so subsequent rate corrections use the new zero.
      sound._rateSeek = safeTarget
      return
    } catch {
      // Fall back to the public Howler API when the media element rejects seek.
    }
  }

  if (soundId === undefined) howl.seek(safeTarget)
  else howl.seek(safeTarget, soundId)
}
