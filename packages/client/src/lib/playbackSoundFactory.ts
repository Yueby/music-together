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
    const { onprogress, ...howlOptions } = options
    const howl = new Howl(howlOptions)
    if (!onprogress || !options.html5) return howl

    // Howler exposes load events but no HTML5 buffering progress event.
    const element = (howl as Howl & { _sounds?: { _node?: HTMLAudioElement }[] })._sounds?.[0]?._node
    if (!element) return howl
    const reportProgress = () => {
      if (howl.state() !== 'loading') return
      const { buffered, duration } = element
      if (buffered.length && Number.isFinite(duration) && duration > 0) {
        onprogress({ phase: 'buffering', progress: buffered.end(buffered.length - 1) / duration })
      }
    }
    element.addEventListener('progress', reportProgress)

    const unload = howl.unload.bind(howl)
    howl.unload = () => {
      element.removeEventListener('progress', reportProgress)
      return unload()
    }
    return howl
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
