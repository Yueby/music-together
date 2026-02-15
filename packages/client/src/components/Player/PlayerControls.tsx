import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { AbilityContext } from '@/providers/AbilityProvider'
import { useSocketContext } from '@/providers/SocketProvider'
import { usePlayerStore } from '@/stores/playerStore'
import { useRoomStore } from '@/stores/roomStore'
import type { PlayMode, VoteAction } from '@music-together/shared'
import { EVENTS, TIMING } from '@music-together/shared'
import { ArrowRightToLine, ListMusic, MessageSquare, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { memo, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'

/** Design-time width (px) at which the controls are laid out — CSS zoom scales from this baseline */
const DESIGN_WIDTH = 300

const PLAY_MODE_CYCLE: PlayMode[] = ['sequential', 'loop-all', 'loop-one', 'shuffle']

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
  onOpenChat: () => void
  onOpenQueue: () => void
  chatUnreadCount: number
  onStartVote: (action: VoteAction, payload?: Record<string, unknown>) => void
}

export const PlayerControls = memo(function PlayerControls({ onPlay, onPause, onSeek, onNext, onPrev, onOpenChat, onOpenQueue, chatUnreadCount, onStartVote }: PlayerControlsProps) {
  const { socket } = useSocketContext()
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const currentTime = usePlayerStore((s) => s.currentTime)
  const duration = usePlayerStore((s) => s.duration)
  const volume = usePlayerStore((s) => s.volume)
  const setVolume = usePlayerStore((s) => s.setVolume)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const queueLength = useRoomStore((s) => s.room?.queue?.length ?? 0)
  const playMode = useRoomStore((s) => s.room?.playMode ?? 'sequential')
  const ability = useContext(AbilityContext)
  const canSeek = ability.can('seek', 'Player')
  const canPlay = ability.can('play', 'Player')
  const canSetMode = ability.can('set-mode', 'Player')
  const canVote = ability.can('vote', 'Player')
  const prevVolumeRef = useRef(0.8)
  const [skipCooldown, setSkipCooldown] = useState(false)
  const [playCooldown, setPlayCooldown] = useState(false)
  const [isSeeking, setIsSeeking] = useState(false)
  const [seekTime, setSeekTime] = useState(0)
  const [volumeOpen, setVolumeOpen] = useState(false)
  const cooldownTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const playCooldownTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const volumeRef = useRef<HTMLDivElement>(null)

  const disabled = !currentTrack

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
      inner.style.zoom = String(wrapper.clientWidth / DESIGN_WIDTH)
    }
    update()
    const ro = new ResizeObserver(() => update())
    ro.observe(wrapper)
    return () => ro.disconnect()
  }, [])

  const handleSkip = (action: () => void, voteAction: 'next' | 'prev') => {
    if (skipCooldown) return
    if (ability.can(voteAction, 'Player')) {
      action()
    } else if (canVote) {
      onStartVote(voteAction)
    }
    setSkipCooldown(true)
    if (cooldownTimer.current) clearTimeout(cooldownTimer.current)
    cooldownTimer.current = setTimeout(
      () => setSkipCooldown(false),
      TIMING.PLAYER_NEXT_DEBOUNCE_MS,
    )
  }

  const handlePlayPause = () => {
    if (playCooldown) return
    if (canPlay) {
      isPlaying ? onPause() : onPlay()
    } else if (canVote) {
      onStartVote(isPlaying ? 'pause' : 'resume')
    }
    setPlayCooldown(true)
    if (playCooldownTimer.current) clearTimeout(playCooldownTimer.current)
    playCooldownTimer.current = setTimeout(
      () => setPlayCooldown(false),
      TIMING.PLAYER_NEXT_DEBOUNCE_MS,
    )
  }

  const toggleMute = () => {
    if (volume === 0) {
      setVolume(prevVolumeRef.current)
    } else {
      prevVolumeRef.current = volume
      setVolume(0)
    }
  }

  // Track hover so desktop users can toggleMute on first click (slider already visible via CSS hover)
  const isHoveringRef = useRef(false)

  // Volume button: if slider already visible (hover or state-open), toggleMute; otherwise open slider
  const handleVolumeClick = () => {
    if (volumeOpen || isHoveringRef.current) {
      toggleMute()
    } else {
      setVolumeOpen(true)
    }
  }

  // Close volume slider when clicking outside
  useEffect(() => {
    if (!volumeOpen) return
    const handler = (e: PointerEvent) => {
      if (volumeRef.current && !volumeRef.current.contains(e.target as Node)) {
        setVolumeOpen(false)
      }
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [volumeOpen])

  const handlePlayModeToggle = () => {
    const currentIdx = PLAY_MODE_CYCLE.indexOf(playMode)
    const nextMode = PLAY_MODE_CYCLE[(currentIdx + 1) % PLAY_MODE_CYCLE.length]
    if (canSetMode) {
      socket.emit(EVENTS.PLAYER_SET_MODE, { mode: nextMode })
    } else if (canVote) {
      onStartVote('set-mode', { mode: nextMode })
    }
  }

  const modeConfig = PLAY_MODE_CONFIG[playMode]
  const ModeIcon = modeConfig.icon

  return (
    <div ref={wrapperRef} className="w-full">
      <div ref={innerRef} className="flex flex-col gap-2" style={{ width: DESIGN_WIDTH }}>
        {/* 1. Progress bar */}
        <div className="flex w-full flex-col gap-1">
          <Slider
            value={[duration > 0 ? ((isSeeking ? seekTime : currentTime) / duration) * 100 : 0]}
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
            <span className="text-xs text-white/50 tabular-nums">
              {formatTime(isSeeking ? seekTime : currentTime)}
            </span>
            <span className="text-xs text-white/50 tabular-nums">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* 2. Controls row — left/right flex-1 keeps center truly centered */}
        <div className="flex w-full items-center">
          {/* Left: volume + play mode */}
          <div className="flex flex-1 items-center justify-start">
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <div ref={volumeRef} className="group/volume relative" onPointerEnter={() => { isHoveringRef.current = true }} onPointerLeave={() => { isHoveringRef.current = false }}>
                  <motion.div whileTap={{ scale: 0.9 }}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-white/70 hover:bg-white/10"
                      onClick={handleVolumeClick}
                      aria-label={volume === 0 ? '取消静音' : '静音'}
                    >
                      {volume === 0 ? (
                        <VolumeX className="h-5 w-5" />
                      ) : (
                        <Volume2 className="h-5 w-5" />
                      )}
                    </Button>
                  </motion.div>

                  {/* Horizontal volume slider panel — state-controlled + hover for desktop */}
                  <div className={cn(
                    'pointer-events-none absolute bottom-full left-0 z-50 pb-2 opacity-0 transition-opacity',
                    'group-hover/volume:pointer-events-auto group-hover/volume:opacity-100',
                    volumeOpen && 'pointer-events-auto opacity-100',
                  )}>
                    <div className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 shadow-lg">
                      <Slider
                        value={[volume * 100]}
                        max={100}
                        step={1}
                        onValueChange={(val) => setVolume(val[0] / 100)}
                        className="w-24"
                        aria-label="音量"
                      />
                      <span className="text-[10px] font-medium tabular-nums text-white/70">
                        {Math.round(volume * 100)}
                      </span>
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">{volumeOpen ? (volume === 0 ? '取消静音' : '静音') : '音量'}</TooltipContent>
            </Tooltip>

            {/* Play mode toggle */}
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <motion.div whileTap={{ scale: 0.9 }}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white/70 hover:bg-white/10"
                    onClick={handlePlayModeToggle}
                    disabled={!canSetMode && !canVote}
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
                        <ModeIcon className="h-4 w-4" />
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
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <motion.div whileTap={{ scale: 0.9 }}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white/70 hover:bg-white/10"
                    disabled={disabled || skipCooldown}
                    onClick={() => handleSkip(onPrev, 'prev')}
                    aria-label="上一首"
                  >
                    <SkipBack className="h-6 w-6" fill="currentColor" />
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>上一首</TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.92 }}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12 rounded-full bg-white/20 text-white/90 hover:bg-white/30 hover:text-white"
                    disabled={disabled || playCooldown}
                    onClick={handlePlayPause}
                    aria-label={isPlaying ? '暂停' : '播放'}
                  >
                    {isPlaying ? (
                      <Pause className="h-7 w-7" fill="currentColor" />
                    ) : (
                      <Play className="ml-0.5 h-7 w-7" fill="currentColor" />
                    )}
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>{isPlaying ? '暂停' : '播放'}</TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <motion.div whileTap={{ scale: 0.9 }}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white/70 hover:bg-white/10"
                    disabled={disabled || skipCooldown}
                    onClick={() => handleSkip(onNext, 'next')}
                    aria-label="下一首"
                  >
                    <SkipForward className="h-6 w-6" fill="currentColor" />
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>下一首</TooltipContent>
            </Tooltip>
          </div>

          {/* Right: chat + queue */}
          <div className="flex flex-1 items-center justify-end">
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <motion.div whileTap={{ scale: 0.9 }}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-8 w-8 text-white/70 hover:bg-white/10"
                    onClick={onOpenChat}
                    aria-label="聊天"
                  >
                    <MessageSquare className="h-5 w-5" />
                    {chatUnreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-white/90 px-1 text-[10px] font-semibold leading-none text-black">
                        {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                      </span>
                    )}
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>聊天</TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <motion.div whileTap={{ scale: 0.9 }}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-8 w-8 text-white/70 hover:bg-white/10"
                    onClick={onOpenQueue}
                    aria-label="播放列表"
                  >
                    <ListMusic className="h-6 w-6" />
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
