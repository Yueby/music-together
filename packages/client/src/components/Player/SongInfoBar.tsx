import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { MarqueeText } from '@/components/ui/marquee-text'
import { usePlayerStore } from '@/stores/playerStore'
import { MessageSquare, Volume2, VolumeX } from 'lucide-react'
import { motion } from 'motion/react'
import { memo, useCallback, useLayoutEffect, useRef } from 'react'

/** Must match PlayerControls.DESIGN_WIDTH so zoom factors are identical */
const DESIGN_WIDTH = 300

/** Apple-style easing — must match NowPlaying for shared layoutId animation */
const SPRING = { type: 'spring' as const, duration: 0.5, bounce: 0.1 }
const LAYOUT_TRANSITION = { layout: SPRING, borderRadius: SPRING }

interface SongInfoBarProps {
  onOpenChat: () => void
  chatUnreadCount: number
}

export const SongInfoBar = memo(function SongInfoBar({ onOpenChat, chatUnreadCount }: SongInfoBarProps) {
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const volume = usePlayerStore((s) => s.volume)
  const setVolume = usePlayerStore((s) => s.setVolume)
  const prevVolumeRef = useRef(0.8)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  const toggleMute = useCallback(() => {
    if (volume === 0) {
      setVolume(prevVolumeRef.current)
    } else {
      prevVolumeRef.current = volume
      setVolume(0)
    }
  }, [volume, setVolume])

  // Zoom scaling — identical to PlayerControls
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

  return (
    <div ref={wrapperRef} className="w-full">
      <div ref={innerRef} className="flex w-full items-end gap-2" style={{ width: DESIGN_WIDTH }}>
        {/* Left: song title + artist — layoutId pairs with NowPlaying compact for shared animation */}
        <motion.div layoutId="song-info" transition={LAYOUT_TRANSITION} className="min-w-0 flex-1">
          <motion.div
            initial={{ fontSize: 18 }}
            animate={{ fontSize: 20 }}
            transition={SPRING}
            className="font-bold leading-tight text-white/90"
          >
            <MarqueeText>
              {currentTrack?.title ?? '暂无歌曲'}
            </MarqueeText>
          </motion.div>
          <motion.div
            initial={{ fontSize: 16 }}
            animate={{ fontSize: 14 }}
            transition={SPRING}
            className="text-white/50"
          >
            <MarqueeText>
              {currentTrack ? currentTrack.artist.join(' / ') : '点击搜索添加歌曲到队列'}
            </MarqueeText>
          </motion.div>
        </motion.div>

        {/* Right-bottom: volume + chat buttons (always visible, aligned to bottom) */}
        <div className="flex shrink-0 items-center">
          <Tooltip delayDuration={300}>
            <Popover>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-white/70 hover:bg-white/10 active:scale-90 transition-transform"
                    aria-label={volume === 0 ? '取消静音' : '调节音量'}
                  >
                    {volume === 0 ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>音量</TooltipContent>
              <PopoverContent
                side="top"
                align="center"
                className="flex w-44 items-center gap-2 rounded-xl px-3 py-2"
              >
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-white/70"
                      onClick={toggleMute}
                    >
                      {volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{volume === 0 ? '取消静音' : '静音'}</TooltipContent>
                </Tooltip>
                <Slider
                  min={0}
                  max={100}
                  value={[volume * 100]}
                  onValueChange={([v]) => setVolume(v / 100)}
                />
                <span className="w-8 shrink-0 text-right text-xs tabular-nums text-white/50">
                  {Math.round(volume * 100)}
                </span>
              </PopoverContent>
            </Popover>
          </Tooltip>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <motion.div whileTap={{ scale: 0.9 }}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 text-white/70 hover:bg-white/10"
                  onClick={onOpenChat}
                  aria-label="聊天"
                >
                  <MessageSquare className="size-5" />
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
        </div>
      </div>
    </div>
  )
})
