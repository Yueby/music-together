import { useEffect, useState } from 'react'
import { artworkLoader } from '@/lib/artwork'

/**
 * The cover source for the fluid background.
 * AMLL's `setAlbum` calls `fetch()` on string sources, which a host with `connect-src 'none'` (the mini-app
 * frame) forbids even for Blob URLs; an already decoded `<img>` goes through a fetch-free path.
 * So a host that has to read the bytes gets an image element, which only appears once the image has loaded.
 * Web keeps passing the URL string untouched.
 *
 * While the next cover is still loading, the previous element stays: the renderer keeps running and cross-fades
 * to the new image instead of being torn down and rebuilt (a WebGL context) on every track change.
 * `hasCover` tells "this track has no cover" (drop the background) from "the cover is still being read".
 * A cover that fails to load clears the background rather than leaving another song's image behind.
 */
export function useBackgroundAlbum(src: string | undefined, hasCover: boolean): string | HTMLImageElement | undefined {
  const [loaded, setLoaded] = useState<HTMLImageElement>()

  useEffect(() => {
    if (!src || artworkLoader.direct) return
    const image = new Image()
    let cancelled = false
    image.onload = () => {
      if (!cancelled) setLoaded(image)
    }
    image.onerror = () => {
      if (!cancelled) setLoaded(undefined)
    }
    image.src = src
    return () => {
      cancelled = true
      image.onload = null
      image.onerror = null
    }
  }, [src])

  if (artworkLoader.direct) return src
  return hasCover ? loaded : undefined
}
