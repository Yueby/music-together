import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { usePlayerStore } from '@/stores/playerStore'
import { useRoomStore } from '@/stores/roomStore'
import { ListMusic, Pause, Play, SkipForward, Volume2, VolumeX } from 'lucide-react'
import { motion } from 'motion/react'
import { useRef } from 'react'

interface PlayerControlsProps {
  onPlay: () => void
  onPause: () => void
  onSeek: (time: number) => void
  onNext: () => void
  onOpenQueue: () => void
}

export function PlayerControls({ onPlay, onPause, onSeek, onNext, onOpenQueue }: PlayerControlsProps) {
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const currentTime = usePlayerStore((s) => s.currentTime)
  const duration = usePlayerStore((s) => s.duration)
  const volume = usePlayerStore((s) => s.volume)
  const setVolume = usePlayerStore((s) => s.setVolume)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const queueLength = useRoomStore((s) => s.room?.queue?.length ?? 0)
  const prevVolumeRef = useRef(0.8)

  const disabled = !currentTrack

  const toggleMute = () => {
    if (volume === 0) {
      setVolume(prevVolumeRef.current)
    } else {
      prevVolumeRef.current = volume
      setVolume(0)
    }
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {/* 1. Progress bar */}
      <div className="flex w-full flex-col gap-1">
        <Slider
          value={[duration > 0 ? (currentTime / duration) * 100 : 0]}
          max={100}
          step={0.1}
          disabled={disabled}
          onValueChange={(val) => {
            if (duration > 0) {
              onSeek((val[0] / 100) * duration)
            }
          }}
          className="w-full"
        />
        <div className="flex w-full justify-between">
          <span className="text-xs text-white/50 tabular-nums">
            {formatTime(currentTime)}
          </span>
          <span className="text-xs text-white/50 tabular-nums">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* 2. Controls row: left volume | center play+next | right queue */}
      <div className="flex w-full items-center">
        {/* Left: volume */}
        <div className="flex flex-1 items-center">
          <div className="group/volume relative">
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-10 w-10 hover:bg-white/10 dark:hover:bg-white/10', volume === 0 ? 'text-white/30' : 'text-white/50')}
              onClick={toggleMute}
            >
              {volume === 0 ? (
                <VolumeX className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </Button>

            {/* Horizontal volume slider panel — floats above on hover */}
            <div className="pointer-events-none absolute bottom-full left-0 z-50 pb-2 opacity-0 transition-opacity group-hover/volume:pointer-events-auto group-hover/volume:opacity-100">
              <div className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 shadow-lg">
                <Slider
                  value={[volume * 100]}
                  max={100}
                  step={1}
                  onValueChange={(val) => setVolume(val[0] / 100)}
                  className="w-24"
                />
                <span className="text-[10px] font-medium tabular-nums text-white/70">
                  {Math.round(volume * 100)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: play/pause + next */}
        <div className="flex items-center gap-2">
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.92 }}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-14 w-14 rounded-full bg-white/20 text-white/90 hover:bg-white/30 hover:text-white dark:hover:bg-white/30 dark:hover:text-white"
                  disabled={disabled}
                  onClick={isPlaying ? onPause : onPlay}
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
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-white/50 hover:bg-white/10 hover:text-white/80 dark:hover:bg-white/10 dark:hover:text-white/80"
                disabled={disabled}
                onClick={onNext}
              >
                <SkipForward className="h-6 w-6" fill="currentColor" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>下一首</TooltipContent>
          </Tooltip>
        </div>

        {/* Right: queue */}
        <div className="flex flex-1 items-center justify-end">
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-10 w-10 text-white/50 hover:bg-white/10 hover:text-white/80 dark:hover:bg-white/10 dark:hover:text-white/80"
                onClick={onOpenQueue}
              >
                <ListMusic className="h-6 w-6" />
                {queueLength > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-white/90 px-1 text-[10px] font-semibold leading-none text-black">
                    {queueLength > 99 ? '99+' : queueLength}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>播放列表</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
