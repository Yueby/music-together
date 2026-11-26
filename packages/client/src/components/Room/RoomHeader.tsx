import { Check, ChevronDown, CircleUserRound, Copy, Ellipsis, Link2, Lock, LogOut, Search, Settings, Users, Wifi, WifiOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { ServerStatusPopoverContent, getEffectiveServerLoad, useHoverPopover } from '@/components/ServerLoadBadge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getMedianRTT } from '@/lib/clockSync'
import { canCopyText, copyText, getRoomShareUrl } from '@/lib/clipboard'
import { hostRuntime } from '@/lib/hostRuntime'
import { cn } from '@/lib/utils'
import { useRoomStore } from '@/stores/roomStore'
import { useServerStatusStore } from '@/stores/serverStatusStore'
import { useSocketContext } from '@/providers/SocketProvider'
import { toast } from 'sonner'

interface RoomHeaderProps {
  onOpenSearch: () => void
  onOpenSettings: () => void
  onOpenAccount: () => void
  onOpenMembers: () => void
  onLeaveRoom: () => void
}

export function RoomHeader({ onOpenSearch, onOpenSettings, onOpenAccount, onOpenMembers, onLeaveRoom }: RoomHeaderProps) {
  // Fine-grained selectors to avoid re-renders from queue/playState changes
  const roomName = useRoomStore((s) => s.room?.name)
  const roomId = useRoomStore((s) => s.room?.id)
  const hasPassword = useRoomStore((s) => s.room?.hasPassword ?? false)
  const userCount = useRoomStore((s) => s.room?.users.length ?? 0)
  const capacity = useServerStatusStore((s) => s.capacity)
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const roomPopover = useHoverPopover()
  const statusPopover = useHoverPopover()
  const { isConnected } = useSocketContext()
  const clipboardAvailable = canCopyText()

  // Poll RTT from clockSync module every 3s
  const [rtt, setRtt] = useState(0)
  useEffect(() => {
    if (!isConnected) {
      setRtt(0)
      return
    }
    setRtt(getMedianRTT())
    const timer = setInterval(() => setRtt(getMedianRTT()), 3000)
    return () => clearInterval(timer)
  }, [isConnected])

  const rttColor = !isConnected
    ? 'text-destructive'
    : rtt < 100
      ? 'text-emerald-500/60'
      : rtt < 300
        ? 'text-yellow-500/60'
        : 'text-destructive/60'

  const roundedRtt = Math.round(rtt)
  const serverLoad = isConnected && capacity ? getEffectiveServerLoad(capacity) : null
  const showLoadDot = serverLoad !== null && serverLoad.level !== 'normal'
  const statusAriaLabel = !isConnected
    ? '连接断开，正在重连'
    : serverLoad
      ? `已连接 · 延迟 ${roundedRtt}ms · ${serverLoad.titleText}`
      : `已连接 · 延迟 ${roundedRtt}ms`

  const [copiedTarget, setCopiedTarget] = useState<'link' | 'id' | null>(null)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
    },
    [],
  )

  const markCopied = (target: 'link' | 'id') => {
    setCopiedTarget(target)
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
    copiedTimerRef.current = setTimeout(() => {
      copiedTimerRef.current = null
      setCopiedTarget(null)
    }, 1500)
  }

  const copyRoomLink = async () => {
    if (roomId && (await copyText(getRoomShareUrl(roomId)))) {
      toast.success('房间链接已复制')
      markCopied('link')
    }
  }

  const copyRoomId = async () => {
    if (roomId && (await copyText(roomId))) {
      toast.success('房间号已复制')
      markCopied('id')
    }
  }

  return (
    <header className="flex items-center justify-between border-b border-border/50 bg-background/95 px-2 py-2 backdrop-blur-sm sm:px-4">
      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        {roomId && (
          <>
            <Popover open={roomPopover.open} onOpenChange={roomPopover.handleOpenChange}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  data-testid="room-identity-trigger"
                  aria-label={`${roomName ?? '房间'}，查看房间号与分享链接`}
                  onPointerEnter={roomPopover.hasHover ? roomPopover.handlePointerEnter : undefined}
                  onPointerLeave={roomPopover.hasHover ? roomPopover.handlePointerLeave : undefined}
                  onClick={roomPopover.handleTriggerClick}
                  className="group -my-1.5 inline-flex min-h-11 min-w-0 max-w-full cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-left transition-colors hover:bg-accent/60 active:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:my-0 sm:h-7 sm:min-h-0"
                >
                  <span
                    data-testid="room-header-title"
                    className="max-w-[172px] truncate text-sm font-semibold text-foreground sm:max-w-[260px] md:max-w-[320px]"
                  >
                    {roomName}
                  </span>
                  <ChevronDown
                    aria-hidden
                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform duration-150 group-hover:text-muted-foreground group-data-[state=open]:rotate-180"
                  />
                </button>
              </PopoverTrigger>

              <PopoverContent
                side="bottom"
                align="start"
                sideOffset={8}
                collisionPadding={12}
                onPointerEnter={roomPopover.hasHover ? roomPopover.handlePointerEnter : undefined}
                onPointerLeave={roomPopover.hasHover ? roomPopover.handlePointerLeave : undefined}
                className="w-60 p-3"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 break-words text-sm font-semibold leading-snug text-foreground">{roomName}</p>
                    {hasPassword && (
                      <span
                        className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        title="需要密码加入"
                      >
                        <Lock className="h-2.5 w-2.5" aria-hidden />
                        加密
                      </span>
                    )}
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] text-muted-foreground">房间号</div>
                      <div
                        data-testid="room-popover-id"
                        className="font-mono text-sm font-semibold tracking-wider tabular-nums text-foreground"
                      >
                        {roomId}
                      </div>
                    </div>
                    {clipboardAvailable && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={copyRoomId}
                        aria-label="复制房间号"
                      >
                        {copiedTarget === 'id' ? (
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </div>

                  {clipboardAvailable && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8 w-full gap-1.5 text-xs"
                      onClick={copyRoomLink}
                      aria-label="复制房间链接"
                    >
                      {copiedTarget === 'link' ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                          已复制房间链接
                        </>
                      ) : (
                        <>
                          <Link2 className="h-3.5 w-3.5" />
                          复制房间链接
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-my-1.5 h-7 min-h-11 min-w-11 shrink-0 gap-1 px-2 text-sm text-muted-foreground sm:my-0 sm:min-h-0 sm:min-w-0 sm:px-1.5"
                  onClick={onOpenMembers}
                  aria-label="查看成员"
                >
                  <Users className="h-3.5 w-3.5" />
                  {userCount}
                </Button>
              </TooltipTrigger>
              <TooltipContent>查看成员</TooltipContent>
            </Tooltip>
          </>
        )}
        {/* Unified connection + RTT + server capacity indicator */}
        <Popover open={statusPopover.open} onOpenChange={statusPopover.handleOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-testid="room-connection-status"
              data-load-level={serverLoad?.level}
              aria-label={statusAriaLabel}
              onPointerEnter={statusPopover.hasHover ? statusPopover.handlePointerEnter : undefined}
              onPointerLeave={statusPopover.hasHover ? statusPopover.handlePointerLeave : undefined}
              onClick={statusPopover.handleTriggerClick}
              className="-my-1.5 inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1 rounded-md px-1.5 text-xs transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:my-0 sm:h-7 sm:min-h-0"
            >
              {isConnected ? (
                <Wifi className={cn('h-4 w-4 shrink-0', rttColor)} />
              ) : (
                <WifiOff className="h-4 w-4 shrink-0 animate-pulse text-destructive motion-reduce:animate-none" />
              )}
              {isConnected && <span className={cn('font-mono text-xs tabular-nums', rttColor)}>{roundedRtt}ms</span>}
              {showLoadDot && (
                <span
                  aria-hidden
                  data-testid="room-server-load-dot"
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    serverLoad.meta.dotClass,
                    serverLoad.meta.pulse && !prefersReducedMotion && 'animate-pulse motion-reduce:animate-none',
                  )}
                />
              )}
            </button>
          </PopoverTrigger>

          <PopoverContent
            side="bottom"
            align="start"
            sideOffset={8}
            collisionPadding={12}
            onPointerEnter={statusPopover.hasHover ? statusPopover.handlePointerEnter : undefined}
            onPointerLeave={statusPopover.hasHover ? statusPopover.handlePointerLeave : undefined}
            className="w-64"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-foreground">
                  {isConnected ? (
                    <Wifi className={cn('h-3.5 w-3.5 shrink-0', rttColor)} />
                  ) : (
                    <WifiOff className="h-3.5 w-3.5 shrink-0 text-destructive" />
                  )}
                  <span className="truncate">{isConnected ? '已连接' : '连接断开，正在重连...'}</span>
                </span>
                {isConnected && (
                  <span className={cn('shrink-0 font-mono text-xs tabular-nums', rttColor)}>{roundedRtt}ms</span>
                )}
              </div>

              {isConnected && capacity && (
                <>
                  <Separator />
                  <ServerStatusPopoverContent capacity={capacity} />
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 min-h-11 min-w-11 sm:min-h-0 sm:min-w-0"
              onClick={onOpenSearch}
              aria-label="搜索点歌"
            >
              <Search className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>搜索点歌</TooltipContent>
        </Tooltip>

        {/* Desktop: inline account, settings & leave buttons */}
        {hostRuntime.platformAccounts && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hidden h-8 w-8 min-h-11 min-w-11 sm:flex sm:min-h-0 sm:min-w-0"
                onClick={onOpenAccount}
                aria-label="音乐账号"
              >
                <CircleUserRound className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>音乐账号</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="hidden h-8 w-8 min-h-11 min-w-11 sm:flex sm:min-h-0 sm:min-w-0"
              onClick={onOpenSettings}
              aria-label="设置"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>设置</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="hidden h-8 w-8 min-h-11 min-w-11 sm:flex sm:min-h-0 sm:min-w-0"
              onClick={onLeaveRoom}
              aria-label="离开房间"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>离开房间</TooltipContent>
        </Tooltip>

        {/* Mobile: dropdown menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 min-h-11 min-w-11 sm:hidden sm:min-h-0 sm:min-w-0"
              aria-label="更多操作"
            >
              <Ellipsis className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {hostRuntime.platformAccounts && (
              <DropdownMenuItem onClick={onOpenAccount}>
                <CircleUserRound className="mr-2 h-4 w-4" />
                音乐账号
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onOpenSettings}>
              <Settings className="mr-2 h-4 w-4" />
              设置
            </DropdownMenuItem>
            {clipboardAvailable && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={copyRoomLink}>
                  <Copy className="mr-2 h-4 w-4" />
                  复制房间链接
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onLeaveRoom}>
              <LogOut className="mr-2 h-4 w-4" />
              离开房间
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
