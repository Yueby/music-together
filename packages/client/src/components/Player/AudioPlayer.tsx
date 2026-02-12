import { NowPlaying } from './NowPlaying'
import { LyricDisplay } from './LyricDisplay'
import { PlayerControls } from './PlayerControls'

interface AudioPlayerProps {
  onPlay: () => void
  onPause: () => void
  onSeek: (time: number) => void
  onNext: () => void
  onOpenQueue: () => void
}

export function AudioPlayer({ onPlay, onPause, onSeek, onNext, onOpenQueue }: AudioPlayerProps) {
  return (
    <div className="flex h-full flex-col p-6">
      {/* Main content: left = song info, right = lyrics */}
      <div className="flex min-h-0 flex-1 gap-6 rounded-2xl bg-muted/30 p-6">
        {/* Left: cover + song info (50%) */}
        <div className="flex w-1/2 flex-col items-center justify-center">
          <NowPlaying />
        </div>

        {/* Right: lyrics (50%) */}
        <div className="min-h-0 w-1/2 overflow-hidden">
          <LyricDisplay />
        </div>
      </div>

      {/* Bottom: controls */}
      <div className="shrink-0 pt-4">
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
