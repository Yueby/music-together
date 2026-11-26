import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAppAbility } from '@/providers/AbilityProvider'
import { useSocketContext } from '@/providers/SocketProvider'
import { usePlayerStore } from '@/stores/playerStore'
import { canSendRoomCommand, useRoomStore } from '@/stores/roomStore'
import type { PlayMode, VoteAction } from '@music-together/shared'
import { EVENTS, TIMING, effectivePlayMode } from '@music-together/shared'
import { ArrowRightToLine, ListMusic, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'

/** Design-time width (px) at which the controls are laid out — CSS zoom scales from this baseline */
const DESIGN_WIDTH = 300

/** Delay before revealing audio loading UI so quick web loads and preloaded tracks never flicker. */
const AUDIO_LOAD_REVEAL_DELAY_MS = 300

/** Perimeter progress ring sized to hug the 56px (h-14 w-14) play/pause button cleanly. */
const PLAY_RING_SIZE = 56
const PLAY_RING_STROKE = 2.5
const PLAY_RING_RADIUS = (PLAY_RING_SIZE - PLAY_RING_STROKE) / 2
const PLAY_RING_CIRCUMFERENCE = 2 * Math.PI * PLAY_RING_RADIUS
/** Indeterminate orbiting arc covers ~28% of the perimeter for a clean luminous sweep. */
const PLAY_RING_ORBIT_ARC = PLAY_RING_CIRCUMFERENCE * 0.28
const PLAY_RING_ORBIT_GAP = PLAY_RING_CIRCUMFERENCE - PLAY_RING_ORBIT_ARC

const WAVE_BARS = [
  { id: 'left', keyframes: [0.34, 0.92, 0.42, 0.72, 0.34], decodingKeyframes: [0.42, 0.68, 0.42], delay: 0, staticHeight: 'h-2.5' },
  { id: 'center', keyframes: [0.56, 1, 0.38, 0.88, 0.56], decodingKeyframes: [0.58, 0.86, 0.58], delay: 0.14, staticHeight: 'h-4.5' },
  { id: 'right', keyframes: [0.4, 0.82, 0.5, 0.95, 0.4], decodingKeyframes: [0.46, 0.74, 0.46], delay: 0.28, staticHeight: 'h-3' },
] as const

function AudioLoadWave({ decoding, reducedMotion }: { decoding: boolean; reducedMotion: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-testid="audio-load-wave"
      data-wave-state={decoding ? 'decoding' : 'loading'}
      className="flex h-5 items-center justify-center gap-[3.5px]"
    >
      {WAVE_BARS.map((bar) =>
        reducedMotion ? (
          <span
            key={bar.id}
            data-wave-bar={bar.id}
            data-reduced-motion="true"
            className={cn('w-[3px] rounded-full bg-white/85', bar.staticHeight)}
          />
        ) : (
          <motion.span
            key={bar.id}
            data-wave-bar={bar.id}
            className="h-5 w-[3px] origin-center rounded-full bg-white/90"
            initial={{ scaleY: decoding ? bar.decodingKeyframes[0] : bar.keyframes[0] }}
            animate={{ scaleY: decoding ? [...bar.decodingKeyframes] : [...bar.keyframes] }}
            transition={{
              duration: decoding ? 1.25 : 1.05,
              delay: bar.delay,
              ease: 'easeInOut',
              repeat: Infinity,
            }}
          />
        ),
      )}
    </span>
  )
}

const PLAY_MODE_CYCLE: PlayMode[] = ['sequential', 'loop-all', 'loop-one', 'shuffle']
/** A queue that is consumed as it plays never comes round again, so looping modes are not offered. */
const CONSUMING_PLAY_MODE_CYCLE: PlayMode[] = ['sequential', 'shuffle']

const PLAY_MODE_CONFIG: Record<PlayMode, { icon: typeof Repeat; label: string }> = {
  sequential: { icon: ArrowRightToLine, label: '顺序播放' },
  'loop-all': { icon: Repeat, label: '列表循环' },
  'loop-one': { icon: Repeat1, label: '单曲循环' },
  shuffle: { icon: Shuffle, label: '随机播放' },
}

interface PlayerControlsProps {
  onPlay: () => void
  onPause: () => void
  onSeek: (time: number) => void
  onNext: () => void
  onPrev: () => void
  onOpenQueue: () => void
  onStartVote: (action: VoteAction, payload?: Record<string, unknown>) => void
}

export const PlayerControls = memo(function PlayerControls({
  onPlay,
  onPause,
  onSeek,
  onNext,
  onPrev,
  onOpenQueue,
  onStartVote,
}: PlayerControlsProps) {
  const { socket } = useSocketContext()
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const currentTime = usePlayerStore((s) => s.currentTime)
  const duration = usePlayerStore((s) => s.duration)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const audioLoadPhase = usePlayerStore((s) => s.audioLoadPhase)
  const audioLoadProgress = usePlayerStore((s) => s.audioLoadProgress)
  const audioLoadStartedAt = usePlayerStore((s) => s.audioLoadStartedAt)
  const prefersReducedMotion = useReducedMotion()
  const queueLength = useRoomStore((s) => s.room?.queue?.length ?? 0)
  const queueMode = useRoomStore((s) => s.room?.queueMode ?? 'keep')
  // What actually plays: the room may have a looping mode stored that its queue mode does not honour.
  const playMode = useRoomStore((s) => effectivePlayMode(s.room?.queueMode, s.room?.playMode ?? 'sequential'))
  const ability = useAppAbility()
  const canSeek = ability.can('seek', 'Player')
  const canPlay = ability.can('play', 'Player')
  const canSetMode = ability.can('set-mode', 'Player')
  const canVote = ability.can('vote', 'Player')
  const [skipCooldown, setSkipCooldown] = useState<'next' | 'prev' | null>(null)
  const [playCooldown, setPlayCooldown] = useState(false)
  const [isSeeking, setIsSeeking] = useState(false)
  const [seekTime, setSeekTime] = useState(0)
  const [loadingRevealed, setLoadingRevealed] = useState(false)
  const cooldownTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const playCooldownTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  const reconnecting = useRoomStore((state) => state.connectionStatus === 'reconnecting')
  const disabled = !currentTrack || reconnecting
  const isAudioLoading = audioLoadPhase !== 'idle'
  const showAudioLoading = isAudioLoading && loadingRevealed

  // Reveal loading animation only after 300ms to prevent flicker on fast loads and preloaded tracks.
  useEffect(() => {
    if (!isAudioLoading) {
      setLoadingRevealed(false)
      return
    }

    const startedAt = audioLoadStartedAt ?? Date.now()
    const elapsed = Math.max(0, Date.now() - startedAt)
    if (elapsed >= AUDIO_LOAD_REVEAL_DELAY_MS) {
      setLoadingRevealed(true)
      return
    }

    setLoadingRevealed(false)
    const revealTimer = setTimeout(() => setLoadingRevealed(true), AUDIO_LOAD_REVEAL_DELAY_MS - elapsed)
    return () => clearTimeout(revealTimer)
  }, [isAudioLoading, audioLoadStartedAt])

  // Clean up cooldown timers on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current)
      if (playCooldownTimer.current) clearTimeout(playCooldownTimer.current)
    }
  }, [])

  // Scale entire controls area proportionally — like the cover image
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current
    const inner = innerRef.current
    if (!wrapper || !inner) return
    const update = () => {
      inner.style.setProperty('zoom', String(wrapper.clientWidth / DESIGN_WIDTH))
    }
    update()
    const ro = new ResizeObserver(() => update())
    ro.observe(wrapper)
    return () => ro.disconnect()
  }, [])

  const handleSkip = (action: () => void, voteAction: 'next' | 'prev') => {
    if (skipCooldown === voteAction) return
    if (ability.can(voteAction, 'Player')) {
      action()
    } else if (canVote) {
      onStartVote(voteAction)
    }
    setSkipCooldown(voteAction)
    if (cooldownTimer.current) clearTimeout(cooldownTimer.current)
    cooldownTimer.current = setTimeout(() => setSkipCooldown(null), TIMING.PLAYER_NEXT_DEBOUNCE_MS)
  }

  const handlePlayPause = () => {
    if (playCooldown) return
    if (canPlay) {
      if (isPlaying) onPause()
      else onPlay()
    } else if (canVote) {
      onStartVote(isPlaying ? 'pause' : 'resume')
    }
    setPlayCooldown(true)
    if (playCooldownTimer.current) clearTimeout(playCooldownTimer.current)
    playCooldownTimer.current = setTimeout(() => setPlayCooldown(false), TIMING.PLAYER_NEXT_DEBOUNCE_MS)
  }

  const handlePlayModeToggle = () => {
    if (!canSendRoomCommand(socket)) return
    const cycle = queueMode === 'consume' ? CONSUMING_PLAY_MODE_CYCLE : PLAY_MODE_CYCLE
    const nextMode = cycle[(cycle.indexOf(playMode) + 1) % cycle.length]
    if (canSetMode) {
      socket.emit(EVENTS.PLAYER_SET_MODE, { mode: nextMode })
    } else if (canVote) {
      onStartVote('set-mode', { mode: nextMode })
    }
  }

  const modeConfig = PLAY_MODE_CONFIG[playMode]
  const ModeIcon = modeConfig.icon
  const playButtonLabel = showAudioLoading ? (isPlaying ? '暂停 · 加载中' : '音频加载中') : isPlaying ? '暂停' : '播放'
  const isDecoding = audioLoadPhase === 'decoding'
  const ringMode: 'decoding' | 'determinate' | 'indeterminate' = isDecoding
    ? 'decoding'
    : audioLoadProgress !== null
      ? 'determinate'
      : 'indeterminate'
  const clampedRingProgress = audioLoadProgress !== null ? Math.max(0, Math.min(1, audioLoadProgress)) : 0

  return (
    <div ref={wrapperRef} className="w-full">
      <div ref={innerRef} className="flex flex-col gap-6" style={{ width: DESIGN_WIDTH }}>
        {/* 1. Progress bar */}
        <div className="flex w-full flex-col gap-1">
          <Slider
            value={[duration > 0 ? ((isSeeking ? seekTime : currentTime) / duration) * 100 : 0]}
            bufferedValue={showAudioLoading && audioLoadProgress !== null ? audioLoadProgress * 100 : undefined}
            loading={showAudioLoading && audioLoadProgress === null}
            max={100}
            step={0.1}
            disabled={disabled || !canSeek}
            onValueChange={(val) => {
              if (duration > 0) {
                setIsSeeking(true)
                setSeekTime((val[0] / 100) * duration)
              }
            }}
            onValueCommit={(val) => {
              if (duration > 0) {
                onSeek((val[0] / 100) * duration)
              }
              setIsSeeking(false)
            }}
            className="w-full"
          />
          <div className="flex w-full justify-between">
            <span className="text-xs text-white/50 tabular-nums">{formatTime(isSeeking ? seekTime : currentTime)}</span>
            <span className="text-xs text-white/50 tabular-nums">{formatTime(duration)}</span>
          </div>
        </div>

        {/* 2. Controls row — left/right flex-1 keeps center truly centered */}
        <div className="flex w-full items-center">
          {/* Left: play mode */}
          <div className="flex flex-1 items-center justify-start">
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <motion.div whileTap={{ scale: 0.9 }}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-white/70 hover:bg-white/10"
                    onClick={handlePlayModeToggle}
                    disabled={reconnecting || (!canSetMode && !canVote)}
                    aria-label={modeConfig.label}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={playMode}
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.6, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <ModeIcon className="size-5" />
                      </motion.div>
                    </AnimatePresence>
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>{modeConfig.label}</TooltipContent>
            </Tooltip>
          </div>

          {/* Center: prev + play/pause + next */}
          <div className="flex items-center gap-2">
            {queueMode === 'consume' ? (
              // What was heard has left a consumed queue, so there is no "previous": no button, but the play button
              // stays where it is (an empty slot the size of the button).
              <span className="size-9" aria-hidden="true" />
            ) : (
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <motion.div whileTap={{ scale: 0.9 }}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-white/70 hover:bg-white/10"
                      disabled={disabled || skipCooldown === 'prev'}
                      onClick={() => handleSkip(onPrev, 'prev')}
                      aria-label="上一首"
                    >
                      <SkipBack className="size-5" fill="currentColor" />
                    </Button>
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent>上一首</TooltipContent>
              </Tooltip>
            )}

            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <motion.div
                  whileHover={prefersReducedMotion ? undefined : { scale: 1.05 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'relative h-14 w-14 rounded-full text-white/90 hover:text-white',
                      showAudioLoading ? 'bg-white/15 hover:bg-white/25' : 'bg-white/20 hover:bg-white/30',
                    )}
                    disabled={disabled || playCooldown}
                    onClick={handlePlayPause}
                    aria-label={playButtonLabel}
                    aria-busy={showAudioLoading}
                  >
                    {showAudioLoading && (
                      <svg
                        aria-hidden="true"
                        data-testid="audio-load-ring"
                        data-ring-mode={ringMode}
                        viewBox={`0 0 ${PLAY_RING_SIZE} ${PLAY_RING_SIZE}`}
                        className={cn(
                          'pointer-events-none absolute inset-0 size-full -rotate-90',
                          ringMode === 'indeterminate' &&
                            !prefersReducedMotion &&
                            'animate-spin [animation-duration:1.1s] motion-reduce:animate-none',
                        )}
                      >
                        <circle
                          cx={PLAY_RING_SIZE / 2}
                          cy={PLAY_RING_SIZE / 2}
                          r={PLAY_RING_RADIUS}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={PLAY_RING_STROKE}
                          className="text-white/15"
                        />
                        {ringMode === 'decoding' ? (
                          <motion.circle
                            cx={PLAY_RING_SIZE / 2}
                            cy={PLAY_RING_SIZE / 2}
                            r={PLAY_RING_RADIUS}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={PLAY_RING_STROKE}
                            strokeLinecap="round"
                            strokeDasharray={PLAY_RING_CIRCUMFERENCE}
                            strokeDashoffset={0}
                            className="text-white/90 drop-shadow-[0_0_6px_rgba(255,255,255,0.35)]"
                            animate={prefersReducedMotion ? { opacity: 0.9 } : { opacity: [0.65, 1, 0.65] }}
                            transition={
                              prefersReducedMotion ? { duration: 0 } : { duration: 1.4, ease: 'easeInOut', repeat: Infinity }
                            }
                          />
                        ) : (
                          <circle
                            cx={PLAY_RING_SIZE / 2}
                            cy={PLAY_RING_SIZE / 2}
                            r={PLAY_RING_RADIUS}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={PLAY_RING_STROKE}
                            strokeLinecap="round"
                            strokeDasharray={
                              ringMode === 'determinate'
                                ? PLAY_RING_CIRCUMFERENCE
                                : `${PLAY_RING_ORBIT_ARC} ${PLAY_RING_ORBIT_GAP}`
                            }
                            strokeDashoffset={
                              ringMode === 'determinate' ? PLAY_RING_CIRCUMFERENCE * (1 - clampedRingProgress) : 0
                            }
                            className={cn(
                              'text-white/90 drop-shadow-[0_0_6px_rgba(255,255,255,0.35)]',
                              ringMode === 'determinate' &&
                                'transition-[stroke-dashoffset] duration-200 ease-out motion-reduce:transition-none',
                            )}
                          />
                        )}
                      </svg>
                    )}
                    <AnimatePresence mode="wait" initial={false}>
                      {showAudioLoading ? (
                        <motion.span
                          key="audio-load-wave"
                          initial={prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
                          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.15, ease: 'easeOut' }}
                          className="flex items-center justify-center"
                        >
                          <AudioLoadWave decoding={isDecoding} reducedMotion={Boolean(prefersReducedMotion)} />
                        </motion.span>
                      ) : (
                        <motion.span
                          key={isPlaying ? 'pause-icon' : 'play-icon'}
                          initial={prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
                          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.15, ease: 'easeOut' }}
                          className="flex items-center justify-center"
                        >
                          {isPlaying ? (
                            <Pause className="size-7" fill="currentColor" />
                          ) : (
                            <Play className="ml-0.5 size-7" fill="currentColor" />
                          )}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>{playButtonLabel}</TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <motion.div whileTap={{ scale: 0.9 }}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-white/70 hover:bg-white/10"
                    disabled={disabled || skipCooldown === 'next'}
                    onClick={() => handleSkip(onNext, 'next')}
                    aria-label="下一首"
                  >
                    <SkipForward className="size-5" fill="currentColor" />
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>下一首</TooltipContent>
            </Tooltip>
          </div>

          {/* Right: queue */}
          <div className="flex flex-1 items-center justify-end">
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <motion.div whileTap={{ scale: 0.9 }}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-9 w-9 text-white/70 hover:bg-white/10"
                    onClick={onOpenQueue}
                    aria-label="播放列表"
                  >
                    <ListMusic className="size-5" />
                    {queueLength > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-white/90 px-1 text-[10px] font-semibold leading-none text-black">
                        {queueLength > 99 ? '99+' : queueLength}
                      </span>
                    )}
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>播放列表</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  )
})
