import { Button } from '@/components/ui/button'
import { useArtworkUrl } from '@/hooks/useArtworkUrl'
import { useInView } from '@/hooks/useInView'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface CoverCardProps {
  title: string
  subtitle?: string
  /** Artwork URL. Loaded only once the card scrolls into view: a long list must not fetch every cover at once. */
  cover?: string
  /** Placeholder shown until (or without) artwork. */
  fallback: ReactNode
  /** Round artwork with centered text, for people (artists); playlists and albums are rounded squares. */
  round?: boolean
  onClick: () => void
}

/** A playlist/album/artist tile: square artwork with the title under it (the layout of a library grid). */
export function CoverCard({ title, subtitle, cover, fallback, round, onClick }: CoverCardProps) {
  const [inViewRef, visible] = useInView<HTMLButtonElement>()
  const src = useArtworkUrl(visible ? cover : undefined)

  return (
    <Button
      ref={inViewRef}
      variant="ghost"
      onClick={onClick}
      className="group h-auto w-full min-w-0 flex-col items-stretch justify-start gap-2 rounded-xl p-2 text-left font-normal whitespace-normal"
    >
      <div
        className={cn('bg-muted relative aspect-square w-full overflow-hidden', round ? 'rounded-full' : 'rounded-lg')}
      >
        {src ? (
          <img
            src={src}
            alt=""
            className={cn('size-full object-cover transition-transform duration-300 group-hover:scale-105')}
            decoding="async"
          />
        ) : (
          <div className="flex size-full items-center justify-center">{fallback}</div>
        )}
      </div>
      <div className={cn('min-w-0 px-0.5', round && 'text-center')}>
        <p className="line-clamp-2 text-sm leading-snug">{title}</p>
        {subtitle ? <p className="text-muted-foreground mt-0.5 truncate text-xs">{subtitle}</p> : null}
      </div>
    </Button>
  )
}

/** Responsive tile grid: 3 columns on a phone, up to 5 on a wide dialog. */
export function CoverGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-3 gap-1 lg:grid-cols-4 xl:grid-cols-5">{children}</div>
}
