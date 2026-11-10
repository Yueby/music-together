import type { PlaybackSoundFactory } from '../../../../client/src/lib/PlaybackSound.ts'
import { getMappHost } from '../hostBinding.ts'

export const playbackSoundFactory: PlaybackSoundFactory = {
  allowLoadRetry: false,
  supportsHtml5Analysis: false,
  create: (track, options) => getMappHost().playbackSoundFactory.create(track, options),
}
