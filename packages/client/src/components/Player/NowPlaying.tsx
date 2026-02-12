import { usePlayerStore } from '@/stores/playerStore'
import { Disc3 } from 'lucide-react'
import { motion } from 'motion/react'

export function NowPlaying() {
  const currentTrack = usePlayerStore((s) => s.currentTrack)

  return (
    <div className="relative z-0 flex w-full flex-col items-center gap-4 md:gap-5">
      {/* Album Cover — rectangular with soft shadow */}
      <div className="relative aspect-square w-full max-w-[min(90%,38vh)]">
        <motion.div
          className="relative h-full w-full overflow-hidden rounded-3xl shadow-lg shadow-black/15"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {currentTrack?.cover ? (
            <img
              src={currentTrack.cover}
              alt={currentTrack.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-secondary">
              <Disc3 className="h-1/3 w-1/3 text-white/20" />
            </div>
          )}
        </motion.div>
      </div>

      {/* Song Info — title + artist only (Apple Music style) */}
      <div className="flex w-full max-w-[min(90%,38vh)] flex-col items-start gap-1 md:gap-1.5">
        <motion.h2
          key={currentTrack?.id ?? 'empty'}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full truncate text-xl font-bold leading-tight text-white/90 md:text-2xl lg:text-3xl"
        >
          {currentTrack?.title ?? '暂无歌曲'}
        </motion.h2>
        <p className="w-full truncate text-sm text-white/50 md:text-base lg:text-lg">
          {currentTrack ? currentTrack.artist.join(' / ') : '点击搜索添加歌曲到队列'}
        </p>
      </div>
    </div>
  )
}
