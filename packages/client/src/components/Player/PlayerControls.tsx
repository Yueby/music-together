import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, ListMusic } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { usePlayerStore } from '@/stores/playerStore'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

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

  const disabled = !currentTrack

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
          {formatTime(currentTime)}
        </span>
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
          className="flex-1"
        />
        <span className="w-10 text-xs text-muted-foreground tabular-nums">
          {formatTime(duration)}
        </span>
      </div>

      {/* Playback controls + volume */}
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center gap-1">
          {/* Volume */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setVolume(volume === 0 ? 0.8 : 0)}
          >
            {volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          <Slider
            value={[volume * 100]}
            max={100}
            step={1}
            onValueChange={(val) => setVolume(val[0] / 100)}
            className="w-24"
          />
        </div>

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled
                >
                  <SkipBack className="h-5 w-5" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>上一首（即将推出）</TooltipContent>
          </Tooltip>
          <Button
            size="icon"
            className="h-12 w-12 rounded-full"
            disabled={disabled}
            onClick={isPlaying ? onPause : onPlay}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled}
            onClick={onNext}
          >
            <SkipForward className="h-5 w-5" />
          </Button>
        </div>

        {/* Right: queue button */}
        <div className="flex flex-1 justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onOpenQueue}>
                <ListMusic className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>播放列表</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
