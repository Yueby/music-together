import { useEffect, useState } from 'react'
import { artworkLoader } from '@/lib/artwork'

const RETRY_DELAY_MS = 2_500

/**
 * The address to show for a cover URL, and whether getting it gave up.
 * Web returns the URL itself on the first render. A host that must read the bytes returns `src: undefined` until the
 * image is ready (and after a failure), so callers keep showing their placeholder; `failed` says that no more attempts
 * will follow, so the placeholder can stop looking like "loading".
 */
export function useArtwork(url: string | undefined): { src: string | undefined; failed: boolean } {
  const [loaded, setLoaded] = useState<{ source: string; src: string }>()
  const [failedUrl, setFailedUrl] = useState<string>()

  useEffect(() => {
    if (!url || artworkLoader.direct) return
    const controller = new AbortController()
    let retry: ReturnType<typeof setTimeout> | undefined
    // The cover is read through the host (a proxy and a CDN behind it): one transient failure should not leave
    // the placeholder in place for the rest of the track.
    const attempt = (retriesLeft: number) => {
      artworkLoader.load(url, controller.signal).then(
        (src) => {
          if (!controller.signal.aborted) setLoaded({ source: url, src })
        },
        () => {
          if (controller.signal.aborted) return
          if (retriesLeft === 0) {
            setFailedUrl(url)
            return
          }
          retry = setTimeout(() => attempt(retriesLeft - 1), RETRY_DELAY_MS)
        },
      )
    }
    attempt(1)
    return () => {
      controller.abort()
      clearTimeout(retry)
    }
  }, [url])

  if (!url) return { src: undefined, failed: false }
  if (artworkLoader.direct) return { src: url, failed: false }
  // A result for a previous URL is never shown for the current one.
  return loaded?.source === url ? { src: loaded.src, failed: false } : { src: undefined, failed: failedUrl === url }
}

/** Just the address (see `useArtwork`). */
export function useArtworkUrl(url: string | undefined): string | undefined {
  return useArtwork(url).src
}
