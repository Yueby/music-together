import { useEffect, useState } from 'react'
import { artworkLoader } from '@/lib/artwork'

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
    artworkLoader.load(url, controller.signal).then(
      (src) => {
        if (!controller.signal.aborted) setLoaded({ source: url, src })
      },
      () => {},
    )
    return () => controller.abort()
  }, [url])

  if (!url) return undefined
  if (artworkLoader.direct) return url
  // A result for a previous URL is never shown for the current one.
  return loaded?.source === url ? loaded.src : undefined
}
