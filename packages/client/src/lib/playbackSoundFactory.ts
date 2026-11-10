import { Howl } from 'howler'
import type { PlaybackSoundFactory } from './PlaybackSound'

/**
 * The one element kept warm for the announced next track. It only opens the connection and reads the metadata:
 * the next real stream then starts without DNS, TLS and CDN cold-start time, while no whole file is downloaded
 * twice. Replaced by the next announcement.
 */
let warmed: HTMLAudioElement | null = null

function releaseWarmed() {
  if (!warmed) return
  warmed.removeAttribute('src')
  warmed.load()
  warmed = null
}

/** Default Web implementation. A host build can replace this module without changing sync hooks. */
export const playbackSoundFactory: PlaybackSoundFactory = {
  allowLoadRetry: true,
  supportsHtml5Analysis: true,
  create(_track, options) {
    // The real stream takes over the connection the warm-up opened.
    releaseWarmed()
    return new Howl(options)
  },
  preload(track) {
    releaseWarmed()
    if (!track.streamUrl || typeof Audio === 'undefined') return
    try {
      const element = new Audio()
      element.preload = 'metadata'
      element.src = track.streamUrl
      warmed = element
    } catch {
      // Warming is an optimisation only.
    }
  },
}
