import type { ReactElement } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PLATFORM_DOT, PLATFORM_LABELS, PLATFORM_SHORT_LABELS } from '@/lib/platform'
import { cn } from '@/lib/utils'
import { MUSIC_SOURCES } from '@music-together/shared'
import type { MusicSource } from '@music-together/shared'

interface PlatformSelectProps {
  value: MusicSource
  onChange: (platform: MusicSource) => void
  className?: string
  /** Accessible name of the control. */
  label?: string
}

/**
 * Vector glyphs drawn directly on a 20×20 coordinate grid so the mark stays optically centred across OS CJK fonts and
 * webfont/fallback switches (e.g. Plus Jakarta Sans on web vs system-ui in the mini-app sandbox).
 * Explicit `size-5` and `text-white` classes prevent SelectTrigger / SelectItem SVG rules from overriding size/color.
 */
function PlatformGlyphSvg({ platform }: { platform: MusicSource }): ReactElement {
  switch (platform) {
    case 'netease':
      return (
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5 text-white"
        >
          <path d="M6.6 6H13.4" />
          <path d="M5 9.2H15" />
          <path d="M9.4 9.2L6.3 13.6L13.1 13.1" />
          <path d="M12 11.3L14.2 14.1" />
        </svg>
      )
    case 'tencent':
      return (
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.85}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5 text-white"
        >
          <ellipse cx={9.8} cy={9.6} rx={3.9} ry={4.1} />
          <path d="M11.6 11.7L14.2 14.3" />
        </svg>
      )
    case 'kugou':
      return (
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5 text-white"
        >
          <path d="M7 5.6V14.4" />
          <path d="M13.5 5.6L7.6 10L13.7 14.4" />
        </svg>
      )
  }
}

/** A platform's round mark: its colour with a fixed-viewBox vector glyph. */
export function PlatformMark({ platform }: { platform: MusicSource }) {
  return (
    <span
      aria-hidden
      data-platform-mark={platform}
      className={cn('flex size-5 shrink-0 items-center justify-center rounded-full', PLATFORM_DOT[platform])}
    >
      <PlatformGlyphSvg platform={platform} />
    </span>
  )
}

/**
 * Chooses a music platform where the platform is a setting rather than content (search, account). The closed control is
 * just the platform's mark — no frame, no background — so it takes the room of an icon button; the menu names them.
 */
export function PlatformSelect({ value, onChange, className, label = '音乐平台' }: PlatformSelectProps) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as MusicSource)}>
      <SelectTrigger
        size="sm"
        aria-label={`${label}：${PLATFORM_LABELS[value]}`}
        title={PLATFORM_LABELS[value]}
        className={cn(
          'hover:bg-accent dark:hover:bg-accent h-auto min-h-11 w-auto gap-0.5 border-transparent bg-transparent px-2 shadow-none dark:bg-transparent sm:min-h-8',
          className,
        )}
      >
        <SelectValue>
          <PlatformMark platform={value} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {MUSIC_SOURCES.map((platform) => (
          <SelectItem key={platform} value={platform}>
            <span className="flex items-center gap-2">
              <PlatformMark platform={platform} />
              {PLATFORM_SHORT_LABELS[platform]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
