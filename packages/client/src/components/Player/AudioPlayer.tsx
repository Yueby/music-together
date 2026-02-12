import { usePlayerStore } from '@/stores/playerStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { BackgroundRender } from '@applemusic-like-lyrics/react'
import { LyricDisplay } from './LyricDisplay'
import { NowPlaying } from './NowPlaying'
import { PlayerControls } from './PlayerControls'

interface AudioPlayerProps {
  onPlay: () => void
  onPause: () => void
  onSeek: (time: number) => void
  onNext: () => void
  onOpenQueue: () => void
}

export function AudioPlayer({ onPlay, onPause, onSeek, onNext, onOpenQueue }: AudioPlayerProps) {
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const bgFps = useSettingsStore((s) => s.bgFps)
  const bgFlowSpeed = useSettingsStore((s) => s.bgFlowSpeed)
  const bgRenderScale = useSettingsStore((s) => s.bgRenderScale)

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* AMLL fluid dynamic background powered by pixi.js */}
      {currentTrack?.cover && (
        <div className="pointer-events-none absolute inset-0 z-0 opacity-80 saturate-[1.3]">
          <BackgroundRender
            album={currentTrack.cover}
            playing={isPlaying}
            fps={bgFps}
            flowSpeed={bgFlowSpeed}
            renderScale={bgRenderScale}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      )}

      {/* Content with padding */}
      <div className="relative z-10 h-full p-[5%]">
        <div className="flex h-full flex-col md:flex-row">
          {/* Left: cover + song info + controls (Apple Music style) */}
          <div className="flex flex-col items-center justify-center gap-4 md:w-[40%] lg:w-[38%]">
            <NowPlaying />
            <div className="relative z-10 w-full max-w-[min(90%,38vh)]">
              <PlayerControls
                onPlay={onPlay}
                onPause={onPause}
                onSeek={onSeek}
                onNext={onNext}
                onOpenQueue={onOpenQueue}
              />
            </div>
          </div>

          {/* Right: AMLL lyrics full height with fade edges */}
          <div
            className="min-h-0 flex-1 overflow-hidden"
            style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)' }}
          >
            <LyricDisplay />
          </div>
        </div>
      </div>
    </div>
  )
}
