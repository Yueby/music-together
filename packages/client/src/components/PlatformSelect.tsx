import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PLATFORM_DOT, PLATFORM_GLYPH, PLATFORM_LABELS, PLATFORM_SHORT_LABELS } from '@/lib/platform'
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

/** A platform's round mark: its colour with one glyph. */
function PlatformMark({ platform }: { platform: MusicSource }) {
  return (
    <span
      aria-hidden
      className={cn(
        // CJK glyphs sit low in their line box; the bottom padding lifts the mark to the visual centre.
        'flex size-5 shrink-0 items-center justify-center rounded-full pb-[3px] text-[11px] leading-none font-bold text-white',
        PLATFORM_DOT[platform],
      )}
    >
      {PLATFORM_GLYPH[platform]}
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
