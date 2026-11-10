import { useEffect, useState } from 'react'
import { artworkLoader } from '@/lib/artwork'

const RETRY_DELAY_MS = 2_500

/**
 * The address to show for a cover URL.
 * Web returns the URL itself on the first render. A host that must read the bytes returns `undefined`
 * until the image is ready (and after a failure), so callers keep showing their placeholder.
 */
export function useArtworkUrl(url: string | undefined): string | undefined {
  const [loaded, setLoaded] = useState<{ source: string; src: string }>()

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
          if (controller.signal.aborted || retriesLeft === 0) return
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

  if (!url) return undefined
  if (artworkLoader.direct) return url
  // A result for a previous URL is never shown for the current one.
  return loaded?.source === url ? loaded.src : undefined
}
