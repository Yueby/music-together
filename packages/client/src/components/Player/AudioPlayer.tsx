import { NowPlaying } from './NowPlaying'
import { LyricDisplay } from './LyricDisplay'
import { PlayerControls } from './PlayerControls'
import { usePlayerStore } from '@/stores/playerStore'

interface AudioPlayerProps {
  onPlay: () => void
  onPause: () => void
  onSeek: (time: number) => void
  onNext: () => void
  onOpenQueue: () => void
}

export function AudioPlayer({ onPlay, onPause, onSeek, onNext, onOpenQueue }: AudioPlayerProps) {
  const currentTrack = usePlayerStore((s) => s.currentTrack)

  return (
    <div className="flex h-full flex-col">
      {/* Top: album cover + song info */}
      <div className="shrink-0 p-6 pb-0">
        <NowPlaying />
      </div>

      {/* Middle: lyrics (scrollable) */}
      <div className="min-h-0 flex-1 overflow-hidden px-6">
        {currentTrack ? <LyricDisplay /> : null}
      </div>

      {/* Bottom: controls */}
      <div className="shrink-0 border-t px-6 py-4">
        <PlayerControls
          onPlay={onPlay}
          onPause={onPause}
          onSeek={onSeek}
          onNext={onNext}
          onOpenQueue={onOpenQueue}
        />
      </div>
    </div>
  )
}
