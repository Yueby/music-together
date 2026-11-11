import { ArtworkImage } from '@/components/ArtworkImage'
import { Button } from '@/components/ui/button'
import { useInView } from '@/hooks/useInView'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface CollectionRowProps {
  title: string
  subtitle?: string
  /** Artwork URL. Hosts that cannot show remote images read the bytes through their own loader (`ArtworkImage` handles both). */
  cover?: string
  /** Placeholder shown until (or without) artwork. */
  fallback: ReactNode
  /** Round artwork for people (artists), rounded square for albums and playlists. */
  round?: boolean
  onClick: () => void
  disabled?: boolean
}

/** One tappable result row (album, playlist or artist): artwork, title and a single line of detail. */
export function CollectionRow({ title, subtitle, cover, fallback, round, onClick, disabled }: CollectionRowProps) {
  // A long result list must not fetch every cover at once: only the rows about to be scrolled to do.
  const [inViewRef, visible] = useInView<HTMLButtonElement>()
  const shape = round ? 'rounded-full' : 'rounded-md'
  return (
    <Button
      ref={inViewRef}
      variant="ghost"
      className="h-auto min-h-12 w-full min-w-0 justify-start gap-3 overflow-hidden rounded-lg p-2 text-left font-normal whitespace-normal"
      onClick={onClick}
      disabled={disabled}
    >
      <ArtworkImage cover={cover} load={visible} alt={title} fallback={fallback} className={cn('size-12', shape)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        {subtitle ? <p className="text-muted-foreground truncate text-xs">{subtitle}</p> : null}
      </div>
    </Button>
  )
}
