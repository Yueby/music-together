import { MarqueeText } from '@/components/ui/marquee-text'
import { cn } from '@/lib/utils'
import { usePlayerStore } from '@/stores/playerStore'
import { Disc3 } from 'lucide-react'
import { motion } from 'motion/react'

/** Apple-style easing: fast launch, graceful deceleration */
const SPRING = { type: 'spring' as const, duration: 0.5, bounce: 0.1 }
const LAYOUT_TRANSITION = { layout: SPRING, borderRadius: SPRING }

interface NowPlayingProps {
  /** Compact mode: small cover + song info in a single row (lyric view top bar) */
  compact?: boolean
  /** Called when the cover art is tapped (toggle lyric view) */
  onCoverClick?: () => void
}

export function NowPlaying({ compact = false, onCoverClick }: NowPlayingProps) {
  const currentTrack = usePlayerStore((s) => s.currentTrack)

  const coverContent = currentTrack?.cover ? (
    <img
      src={currentTrack.cover}
      alt={currentTrack.title}
      className="h-full w-full object-cover"
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-secondary">
      <Disc3 className={cn('text-white/20', compact ? 'h-6 w-6' : 'h-1/3 w-1/3')} />
    </div>
  )

  // ---------------------------------------------------------------------------
  // Compact mode: small cover + song info in a horizontal row (lyric view)
  // ---------------------------------------------------------------------------
  if (compact) {
    return (
      <div className="flex w-full items-center gap-3 pb-1">
        <motion.div
          layoutId="cover-art"
          onClick={onCoverClick}
          whileTap={{ scale: 0.92 }}
          transition={LAYOUT_TRANSITION}
          animate={{ borderRadius: 6 }}
          className="h-12 w-12 shrink-0 cursor-pointer overflow-hidden shadow-md shadow-black/20"
        >
          {coverContent}
        </motion.div>
        <motion.div layoutId="song-info" transition={LAYOUT_TRANSITION} className="min-w-0 flex-1">
          <motion.div
            initial={{ fontSize: 20 }}
            animate={{ fontSize: 18 }}
            transition={SPRING}
            className="font-semibold leading-tight text-white/90"
          >
            <MarqueeText>
              {currentTrack?.title ?? '暂无歌曲'}
            </MarqueeText>
          </motion.div>
          <motion.div
            initial={{ fontSize: 14 }}
            animate={{ fontSize: 16 }}
            transition={SPRING}
            className="text-white/50"
          >
            <MarqueeText>
              {currentTrack ? currentTrack.artist.join(' / ') : '...'}
            </MarqueeText>
          </motion.div>
        </motion.div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Default mode: cover only (song info is handled by SongInfoBar)
  // ---------------------------------------------------------------------------
  return (
    <div className="relative aspect-square w-full">
      <motion.div
        layoutId="cover-art"
        onClick={onCoverClick}
        whileTap={onCoverClick ? { scale: 0.96 } : undefined}
        transition={LAYOUT_TRANSITION}
        animate={{ borderRadius: 24 }}
        className={cn(
          'relative h-full w-full overflow-hidden shadow-lg shadow-black/15',
          onCoverClick && 'cursor-pointer',
        )}
      >
        {coverContent}
      </motion.div>
    </div>
  )
}
