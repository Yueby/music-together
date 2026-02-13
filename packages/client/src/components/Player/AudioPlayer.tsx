import { useIsMobile } from '@/hooks/useIsMobile'
import { useVote } from '@/hooks/useVote'
import { cn } from '@/lib/utils'
import { usePlayerStore } from '@/stores/playerStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { BackgroundRender } from '@applemusic-like-lyrics/react'
import { VoteBanner } from '../Vote/VoteBanner'
import { LyricDisplay } from './LyricDisplay'
import { NowPlaying } from './NowPlaying'
import { PlayerControls } from './PlayerControls'

const FULL_SIZE_STYLE = { width: '100%', height: '100%' } as const

interface AudioPlayerProps {
  onPlay: () => void
  onPause: () => void
  onSeek: (time: number) => void
  onNext: () => void
  onPrev: () => void
  onOpenChat: () => void
  onOpenQueue: () => void
  chatUnreadCount: number
}

export function AudioPlayer({ onPlay, onPause, onSeek, onNext, onPrev, onOpenChat, onOpenQueue, chatUnreadCount }: AudioPlayerProps) {
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const { activeVote, castVote, startVote } = useVote()
  const bgFps = useSettingsStore((s) => s.bgFps)
  const bgFlowSpeed = useSettingsStore((s) => s.bgFlowSpeed)
  const bgRenderScale = useSettingsStore((s) => s.bgRenderScale)
  const mobileLyricPosition = useSettingsStore((s) => s.mobileLyricPosition)
  const isMobile = useIsMobile()

  const showLyricsAboveControls = isMobile && mobileLyricPosition === 'above'

  const lyricsSection = (
    <div
      className={cn(
        'min-h-0 w-full flex-1 overflow-hidden',
        isMobile && 'px-4',
      )}
      style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)' }}
    >
      <LyricDisplay />
    </div>
  )

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* AMLL fluid dynamic background powered by pixi.js */}
      {currentTrack?.cover && (
        <div className="pointer-events-none absolute inset-0 z-0 opacity-80 saturate-[1.3]">
          <BackgroundRender
            album={currentTrack.cover}
            playing
            fps={bgFps}
            flowSpeed={bgFlowSpeed}
            renderScale={bgRenderScale}
            style={FULL_SIZE_STYLE}
          />
        </div>
      )}

      {/* Content with padding */}
      <div className="relative z-10 h-full p-[5%]">
        <div className="flex h-full flex-col md:flex-row">
          {/* Left: cover + song info + controls (Apple Music style) */}
          <div className={cn(
            'flex flex-col items-center gap-4 md:gap-8 md:w-[40%] md:justify-center lg:w-[38%]',
            showLyricsAboveControls ? 'flex-1' : 'justify-center',
          )}>
            {showLyricsAboveControls ? (
              <>
                <div className="w-full max-w-[min(90%,38vh)]">
                  <NowPlaying />
                </div>
                {lyricsSection}
                <div className="relative z-10 mt-auto w-full max-w-[min(90%,38vh)]">
                  {activeVote && <div className="mb-2"><VoteBanner vote={activeVote} onCastVote={castVote} /></div>}
                  <PlayerControls
                    onPlay={onPlay}
                    onPause={onPause}
                    onSeek={onSeek}
                    onNext={onNext}
                    onPrev={onPrev}
                    onOpenChat={onOpenChat}
                    onOpenQueue={onOpenQueue}
                    chatUnreadCount={chatUnreadCount}
                    onStartVote={startVote}
                  />
                </div>
              </>
            ) : (
              <div className="flex w-full max-w-[min(90%,38vh)] flex-col gap-4 md:gap-8">
                <NowPlaying />
                {activeVote && <VoteBanner vote={activeVote} onCastVote={castVote} />}
                <PlayerControls
                  onPlay={onPlay}
                  onPause={onPause}
                  onSeek={onSeek}
                  onNext={onNext}
                  onPrev={onPrev}
                  onOpenChat={onOpenChat}
                  onOpenQueue={onOpenQueue}
                  chatUnreadCount={chatUnreadCount}
                  onStartVote={startVote}
                />
              </div>
            )}
          </div>

          {/* Right / Below: AMLL lyrics full height with fade edges */}
          {!showLyricsAboveControls && lyricsSection}
        </div>
      </div>
    </div>
  )
}
