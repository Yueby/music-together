import { createHtmlAudioSound } from './htmlAudioSound'
import type { PlaybackSoundFactory } from './PlaybackSound'

/** Default Web implementation backed by pooled native HTMLAudioElements. */
export const playbackSoundFactory: PlaybackSoundFactory = {
  allowLoadRetry: true,
  supportsHtml5Analysis: true,
  create(_track, options) {
    return createHtmlAudioSound(options)
  },
}
