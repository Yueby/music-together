import { Disc3 } from 'lucide-react'
import { usePlayerStore } from '@/stores/playerStore'

export function NowPlaying() {
  const currentTrack = usePlayerStore((s) => s.currentTrack)

  return (
    <div className="flex w-full flex-col items-center gap-5">
      {/* Album Cover — responsive size based on viewport height */}
      {currentTrack?.cover ? (
        <img
          src={currentTrack.cover}
          alt={currentTrack.title}
          className="aspect-square w-full max-w-[min(80%,45vh)] rounded-2xl object-cover shadow-xl"
        />
      ) : (
        <div className="flex aspect-square w-full max-w-[min(80%,45vh)] items-center justify-center rounded-2xl bg-muted shadow-xl">
          <Disc3
            className={`h-1/4 w-1/4 text-muted-foreground ${!currentTrack ? 'animate-spin-slow' : ''}`}
          />
        </div>
      )}

      {/* Song Info */}
      <div className="flex w-full max-w-[min(80%,45vh)] flex-col gap-1.5">
        <h2 className="truncate text-lg font-bold leading-tight lg:text-xl xl:text-2xl">
          {currentTrack?.title ?? '暂无歌曲'}
        </h2>
        <p className="truncate text-sm text-muted-foreground lg:text-base">
          {currentTrack ? currentTrack.artist.join(' / ') : '点击搜索添加歌曲到队列'}
        </p>
        {currentTrack?.album && (
          <p className="truncate text-xs text-muted-foreground/70 lg:text-sm">
            {currentTrack.album}
          </p>
        )}
      </div>
    </div>
  )
}
