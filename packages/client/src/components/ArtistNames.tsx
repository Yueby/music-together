import { Button } from '@/components/ui/button'
import { hasArtistPages, isRealArtistName, trackArtists } from '@/lib/artistLink'
import { cn } from '@/lib/utils'
import { openArtistPage } from '@/stores/artistPageStore'
import type { Track } from '@music-together/shared'

interface ArtistNamesProps {
  track: Pick<Track, 'source' | 'artist' | 'artistIds'>
  /** Used instead of the artist page where the platform has none (e.g. search for the name). Without it the name is plain text. */
  onUnsupportedClick?: (name: string) => void
  /** Extra classes for a name, for backgrounds where the default hover colour does not show (the player). */
  className?: string
}

/**
 * A track's artist names, "A / B / C", each opening that artist's page. Wherever a name is shown, clicking it should
 * lead to the artist's songs, so every place that shows one uses this.
 */
export function ArtistNames({ track, onUnsupportedClick, className }: ArtistNamesProps) {
  const supported = hasArtistPages(track.source)
  return (
    <>
      {trackArtists(track).map((artist, index) => {
        const open = !isRealArtistName(artist.name)
          ? undefined
          : supported
            ? () => openArtistPage(artist)
            : onUnsupportedClick && (() => onUnsupportedClick(artist.name))
        return (
          <span key={`${artist.name}-${index}`}>
            {index > 0 ? ' / ' : null}
            {open ? (
              // Reads as the surrounding text, not as a button: it sits inside a truncating line. On a touch screen the
              // tappable area reaches past the text; a click must not also trigger the row it sits in.
              <Button
                variant="link"
                className={cn(
                  'relative inline h-auto p-0 align-baseline text-[length:inherit] font-[inherit] text-inherit',
                  'hover:text-foreground pointer-coarse:after:absolute pointer-coarse:after:-inset-x-1 pointer-coarse:after:-inset-y-2.5',
                  // The line truncates (clips), which would cut a focus ring off: show focus as an underline instead.
                  'focus-visible:text-foreground focus-visible:underline focus-visible:ring-0',
                  className,
                )}
                onClick={(event) => {
                  event.stopPropagation()
                  open()
                }}
              >
                {artist.name}
              </Button>
            ) : (
              artist.name
            )}
          </span>
        )
      })}
    </>
  )
}
