import { Skeleton } from '@/components/ui/skeleton'
import { useArtwork } from '@/hooks/useArtworkUrl'
import { cn } from '@/lib/utils'
import { useState, type ReactNode } from 'react'

interface ArtworkImageProps {
  /** Artwork URL. Without one (or when it cannot be loaded) the `fallback` shows. */
  cover?: string
  /** False holds the loading off (a list row that has not scrolled into view yet); it looks like loading meanwhile. */
  load?: boolean
  /** The URL itself is not known yet (the thing it belongs to is still being fetched): shows as loading. */
  pending?: boolean
  alt?: string
  /** What shows when there is no artwork, or it failed: usually a quiet icon. */
  fallback: ReactNode
  /** Size and shape of the frame (the image fills it and is clipped to it). */
  className?: string
  /** Extra classes for the `<img>` itself (a hover zoom, say). */
  imgClassName?: string
  /** Lets the browser hold the image back until it is near the viewport. */
  lazy?: boolean
  /** For hosts that block hot-linking (account avatars). */
  referrerPolicy?: React.ImgHTMLAttributes<HTMLImageElement>['referrerPolicy']
}

/**
 * Artwork in a frame that says what is going on: a pulsing block while the image is on its way (it was asked for, or is
 * still being read through the host), the image fading in once it is there, and the fallback icon only when there is
 * nothing to show — so a placeholder always means "no cover", never "maybe still loading".
 */
export function ArtworkImage({
  cover,
  load = true,
  pending = false,
  alt = '',
  fallback,
  className,
  imgClassName,
  lazy,
  referrerPolicy,
}: ArtworkImageProps) {
  const { src, failed } = useArtwork(load ? cover : undefined)
  const [shown, setShown] = useState<{ src: string; status: 'loaded' | 'error' }>()
  const status = src && shown?.src === src ? shown.status : 'pending'

  const showImage = Boolean(src) && status !== 'error'
  const empty = !pending && (!cover || failed || status === 'error')
  const loading = pending || (!empty && status !== 'loaded')

  return (
    <div className={cn('bg-muted relative shrink-0 overflow-hidden', className)}>
      {showImage ? (
        <img
          src={src}
          alt={alt}
          decoding="async"
          loading={lazy ? 'lazy' : undefined}
          referrerPolicy={referrerPolicy}
          onLoad={() => src && setShown({ src, status: 'loaded' })}
          onError={() => src && setShown({ src, status: 'error' })}
          className={cn(
            'size-full object-cover transition-opacity duration-300 motion-reduce:transition-none',
            status === 'loaded' ? 'opacity-100' : 'opacity-0',
            imgClassName,
          )}
        />
      ) : null}
      {loading ? <Skeleton aria-hidden className="absolute inset-0 rounded-none" /> : null}
      {empty ? <div className="absolute inset-0 flex items-center justify-center">{fallback}</div> : null}
    </div>
  )
}
