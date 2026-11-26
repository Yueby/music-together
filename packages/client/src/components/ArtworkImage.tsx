import { useArtwork } from '@/hooks/useArtworkUrl'
import { cn } from '@/lib/utils'
import { m, useReducedMotion } from 'motion/react'
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
  /** Optional foreground motif rendered above the loading shimmer while the cover is on its way. */
  loadingSlot?: ReactNode
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
 * Artwork in a frame that says what is going on: a layered dark-glass shimmer (plus an optional `loadingSlot`) while
 * the image is on its way, a smooth reveal once it is there, and the fallback icon only when there is nothing to show
 * — so a placeholder always means "no cover", never "maybe still loading".
 */
export function ArtworkImage({
  cover,
  load = true,
  pending = false,
  alt = '',
  fallback,
  loadingSlot,
  className,
  imgClassName,
  lazy,
  referrerPolicy,
}: ArtworkImageProps) {
  const { src, failed } = useArtwork(load ? cover : undefined)
  const prefersReducedMotion = useReducedMotion()
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
            'size-full object-cover transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none',
            status === 'loaded' ? 'scale-100 opacity-100' : 'scale-[1.02] opacity-0 motion-reduce:scale-100',
            imgClassName,
          )}
        />
      ) : null}
      {loading ? (
        <div
          aria-hidden={!loadingSlot}
          data-slot="artwork-loading"
          className="pointer-events-none absolute inset-0 overflow-hidden bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-black/20 ring-1 ring-inset ring-white/[0.06]"
        >
          <div aria-hidden="true" data-slot="skeleton" className="absolute inset-0 bg-white/[0.03]">
            {prefersReducedMotion ? (
              <div
                data-slot="artwork-shimmer"
                data-reduced-motion="true"
                className="absolute inset-0 bg-gradient-to-br from-white/[0.07] via-transparent to-white/[0.03]"
              />
            ) : (
              <m.div
                data-slot="artwork-shimmer"
                className="absolute -inset-y-8 -left-1/2 w-[75%] -skew-x-12 bg-gradient-to-r from-transparent via-white/[0.14] to-transparent"
                initial={{ x: '-60%' }}
                animate={{ x: '260%' }}
                transition={{ duration: 1.65, ease: [0.4, 0, 0.2, 1], repeat: Infinity, repeatDelay: 0.25 }}
              />
            )}
          </div>
          {loadingSlot ? <div className="relative z-10 flex size-full items-center justify-center">{loadingSlot}</div> : null}
        </div>
      ) : null}
      {empty ? <div className="absolute inset-0 flex items-center justify-center">{fallback}</div> : null}
    </div>
  )
}
