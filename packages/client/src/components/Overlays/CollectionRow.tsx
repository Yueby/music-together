import { useArtworkUrl } from '@/hooks/useArtworkUrl'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface CollectionRowProps {
  title: string
  subtitle?: string
  /** Artwork URL. Hosts that cannot show remote images read the bytes through their own loader (`useArtworkUrl`). */
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
  const src = useArtworkUrl(cover)
  const shape = round ? 'rounded-full' : 'rounded-md'
  return (
    <button
      type="button"
      className="hover:bg-accent flex min-h-12 w-full min-w-0 items-center gap-3 overflow-hidden rounded-lg p-2 text-left transition-colors disabled:pointer-events-none disabled:opacity-50"
      onClick={onClick}
      disabled={disabled}
    >
      {src ? (
        <img src={src} alt={title} className={cn('h-12 w-12 shrink-0 object-cover', shape)} loading="lazy" />
      ) : (
        <div className={cn('bg-muted flex h-12 w-12 shrink-0 items-center justify-center', shape)}>{fallback}</div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        {subtitle ? <p className="text-muted-foreground truncate text-xs">{subtitle}</p> : null}
      </div>
    </button>
  )
}
