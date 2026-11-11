import { ArtistNames } from '@/components/ArtistNames'
import { ArtworkImage } from '@/components/ArtworkImage'
import { MarqueeText } from '@/components/ui/marquee-text'
import { cn } from '@/lib/utils'
import { usePlayerStore } from '@/stores/playerStore'
import { Disc3 } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { LAYOUT_TRANSITION, SPRING } from './constants'

interface NowPlayingProps {
  /** Compact mode: small cover + song info in a single row (lyric view top bar) */
  compact?: boolean
  /** Called when the cover art is tapped (toggle lyric view) */
  onCoverClick?: () => void
}

export function NowPlaying({ compact = false, onCoverClick }: NowPlayingProps) {
  const currentTrack = usePlayerStore((s) => s.currentTrack)

  // Skip layoutId on first frame to prevent unwanted entry animation
  const [ready, setReady] = useState(false)
  useEffect(() => {
    setReady(true)
  }, [])
  const layoutId = ready ? 'cover-art' : undefined

  const coverContent = (
    <ArtworkImage
      cover={currentTrack?.cover}
      alt={currentTrack?.title}
      fallback={<Disc3 className={cn('text-white/20', compact ? 'h-6 w-6' : 'h-1/3 w-1/3')} />}
      className="bg-secondary h-full w-full"
    />
  )

  // ---------------------------------------------------------------------------
  // Compact mode: small cover + song info in a horizontal row (lyric view)
  // ---------------------------------------------------------------------------
  if (compact) {
    return (
      <div className="flex w-full items-center gap-3.5">
        <motion.div
          layoutId={layoutId}
          onClick={onCoverClick}
          whileTap={{ scale: 0.92 }}
          transition={LAYOUT_TRANSITION}
          className="h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-lg shadow-md shadow-black/20"
        >
          {coverContent}
        </motion.div>
        <motion.div
          layoutId={ready ? 'song-info' : undefined}
          transition={LAYOUT_TRANSITION}
          className="min-w-0 flex-1"
        >
          <motion.div
            initial={{ fontSize: 20 }}
            animate={{ fontSize: 22 }}
            transition={SPRING}
            className="font-semibold leading-tight text-white/90"
          >
            <MarqueeText>{currentTrack?.title ?? '暂无歌曲'}</MarqueeText>
          </motion.div>
          <motion.div
            initial={{ fontSize: 14 }}
            animate={{ fontSize: 16 }}
            transition={SPRING}
            className="text-white/50"
          >
            <MarqueeText>
              {currentTrack ? <ArtistNames track={currentTrack} className="hover:text-white hover:underline" /> : '...'}
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
    <motion.div
      layoutId={layoutId}
      onClick={onCoverClick}
      whileTap={onCoverClick ? { scale: 0.96 } : undefined}
      transition={LAYOUT_TRANSITION}
      style={{ width: 'min(100cqw, 100cqh)' }}
      className={cn(
        'relative mx-auto aspect-square overflow-hidden rounded-3xl shadow-lg shadow-black/15',
        onCoverClick && 'cursor-pointer',
      )}
    >
      {coverContent}
    </motion.div>
  )
}
