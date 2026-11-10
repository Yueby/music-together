import { getMappHost } from '../hostBinding.ts'

export function isAudioUnlocked(): boolean {
  return getMappHost().isAudioUnlocked()
}
export function unlockAudio(): Promise<void> {
  return getMappHost().unlockAudio()
}
