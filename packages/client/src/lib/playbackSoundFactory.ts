import { Howl } from 'howler'
import type { PlaybackSoundFactory } from './PlaybackSound'

/** Default Web implementation. A host build can replace this module without changing sync hooks. */
export const playbackSoundFactory: PlaybackSoundFactory = {
  allowLoadRetry: true,
  supportsHtml5Analysis: true,
  create: (_track, options) => new Howl(options),
}
