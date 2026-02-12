import { Disc3 } from 'lucide-react'
import { usePlayerStore } from '@/stores/playerStore'

export function NowPlaying() {
  const currentTrack = usePlayerStore((s) => s.currentTrack)

  return (
    <div className="flex items-start gap-6">
      {/* Album Cover */}
      <div className="shrink-0">
        {currentTrack?.cover ? (
          <img
            src={currentTrack.cover}
            alt={currentTrack.title}
            className="h-48 w-48 rounded-2xl object-cover shadow-lg"
          />
        ) : (
          <div className="flex h-48 w-48 items-center justify-center rounded-2xl bg-muted shadow-lg">
            <Disc3
              className={`h-20 w-20 text-muted-foreground ${!currentTrack ? 'animate-spin-slow' : ''}`}
            />
          </div>
        )}
      </div>

      {/* Song Info */}
      <div className="flex min-w-0 flex-col gap-1 pt-2">
        <h2 className="truncate text-2xl font-bold">
          {currentTrack?.title ?? '暂无歌曲'}
        </h2>
        <p className="truncate text-lg text-muted-foreground">
          {currentTrack ? currentTrack.artist.join(' / ') : '点击搜索添加歌曲到队列'}
        </p>
        {currentTrack?.album && (
          <p className="truncate text-sm text-muted-foreground">
            {currentTrack.album}
          </p>
        )}
      </div>
    </div>
  )
}
