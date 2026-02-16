import { useIsMobile } from '@/hooks/useIsMobile'
import { useVote } from '@/hooks/useVote'
import { cn } from '@/lib/utils'
import { usePlayerStore } from '@/stores/playerStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { BackgroundRender } from '@applemusic-like-lyrics/react'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { useCallback, useState } from 'react'
import { VoteBanner } from '../Vote/VoteBanner'
import { LyricDisplay } from './LyricDisplay'
import { NowPlaying } from './NowPlaying'
import { PlayerControls } from './PlayerControls'
import { SongInfoBar } from './SongInfoBar'

const FULL_SIZE_STYLE = { width: '100%', height: '100%' } as const

const LYRIC_MASK_STYLE = {
  maskImage: 'linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)',
  WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)',
} as const

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
  const isMobile = useIsMobile()

  // Mobile: toggle between cover view and lyric view
  const [lyricExpanded, setLyricExpanded] = useState(false)
  const toggleLyricView = useCallback(() => setLyricExpanded((v) => !v), [])

  const playerControlsProps = {
    onPlay, onPause, onSeek, onNext, onPrev,
    onOpenQueue,
    onStartVote: startVote,
  } as const

  const songInfoProps = {
    onOpenChat,
    chatUnreadCount,
  } as const

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
      <div className="relative z-10 h-full px-5 py-7 md:px-[5%] md:py-[4%] lg:px-[6%] lg:py-[5%]">
        <div className={cn('flex h-full', isMobile ? 'flex-col' : 'flex-row')}>

          {/* ----------------------------------------------------------------- */}
          {/* Mobile layout: dual-mode (cover view / lyric view)                */}
          {/* ----------------------------------------------------------------- */}
          {isMobile ? (
            <LayoutGroup>
              <div className="relative mx-auto flex h-full w-full max-w-sm flex-col items-center gap-6">
                {/* 1. Cover — fills remaining space in cover mode */}
                <motion.div layout transition={{ layout: { type: 'spring' as const, duration: 0.5, bounce: 0.1 } }} className={cn('w-full', !lyricExpanded && 'flex-1 min-h-0')}>
                  <NowPlaying compact={lyricExpanded} onCoverClick={toggleLyricView} />
                </motion.div>

                {/* Lyrics — AnimatePresence always mounted so exit animation fires */}
                <AnimatePresence mode="wait">
                  {lyricExpanded && (
                    <motion.div
                      key="lyrics"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className="min-h-0 w-full flex-1 overflow-hidden"
                      style={LYRIC_MASK_STYLE}
                    >
                      <LyricDisplay />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 2. Song info + action buttons (independent zoom module) */}
                {!lyricExpanded && (
                  <div className="w-full">
                    <SongInfoBar {...songInfoProps} />
                  </div>
                )}

                {/* 3. Controls (independent zoom module) */}
                <div className="relative z-10 w-full">
                  <PlayerControls {...playerControlsProps} />
                </div>

                {/* Vote banner: absolute overlay at the bottom */}
                {activeVote && (
                  <div className="absolute bottom-0 left-1/2 z-20 w-full -translate-x-1/2 px-2 pb-2">
                    <VoteBanner vote={activeVote} onCastVote={castVote} />
                  </div>
                )}
              </div>
            </LayoutGroup>
          ) : (
            // ---------------------------------------------------------------
            // Desktop layout: left panel (cover + info + controls) + right lyrics
            // ---------------------------------------------------------------
            <>
              <div className="relative flex w-[36%] flex-col items-center justify-center gap-8 lg:w-[33%]">
                <div className="flex w-full max-w-[min(90%,48vh)] flex-col gap-8">
                  {/* 1. Cover */}
                  <NowPlaying />
                  {/* 2. Song info + action buttons */}
                  <SongInfoBar {...songInfoProps} />
                  {/* 3. Controls */}
                  <PlayerControls {...playerControlsProps} />
                </div>
                {activeVote && (
                  <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center px-2 pb-2">
                    <div className="w-full max-w-[min(90%,48vh)]">
                      <VoteBanner vote={activeVote} onCastVote={castVote} />
                    </div>
                  </div>
                )}
              </div>
              <div
                className="min-h-0 w-full flex-1 overflow-hidden"
                style={LYRIC_MASK_STYLE}
              >
                <LyricDisplay />
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
