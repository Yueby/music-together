import { Copy, Ellipsis, LogOut, Search, Settings, Users, Wifi, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getMedianRTT } from '@/lib/clockSync'
import { useRoomStore } from '@/stores/roomStore'
import { useSocketContext } from '@/providers/SocketProvider'
import { toast } from 'sonner'

interface RoomHeaderProps {
  onOpenSearch: () => void
  onOpenSettings: () => void
  onOpenMembers: () => void
  onLeaveRoom: () => void
}

export function RoomHeader({ onOpenSearch, onOpenSettings, onOpenMembers, onLeaveRoom }: RoomHeaderProps) {
  // Fine-grained selectors to avoid re-renders from queue/playState changes
  const roomName = useRoomStore((s) => s.room?.name)
  const roomId = useRoomStore((s) => s.room?.id)
  const userCount = useRoomStore((s) => s.room?.users.length ?? 0)
  const { isConnected } = useSocketContext()

  // Poll RTT from clockSync module every 3s
  const [rtt, setRtt] = useState(0)
  useEffect(() => {
    if (!isConnected) { setRtt(0); return }
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

  const copyRoomId = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId)
      toast.success('房间号已复制')
    }
  }

  return (
    <header className="flex items-center justify-between border-b border-border/50 bg-background/95 px-2 py-2 backdrop-blur-sm sm:px-4">
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
        {roomId && (
          <>
            <span
              className="max-w-[120px] cursor-pointer truncate text-sm font-semibold text-foreground active:opacity-70 sm:max-w-[200px] sm:cursor-default"
              onClick={copyRoomId}
            >
              {roomName}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden h-7 gap-1 border-border/50 px-2 font-mono text-xs sm:flex"
                  onClick={copyRoomId}
                  aria-label="复制房间号"
                >
                  {roomId}
                  <Copy className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>复制房间号</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-1.5 text-sm text-muted-foreground"
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
        {/* Connection status + RTT indicator */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex items-center gap-1" role="status" aria-live="polite" aria-label={isConnected ? `已连接 · 延迟 ${Math.round(rtt)}ms` : '连接断开，正在重连'}>
              {isConnected ? (
                <Wifi className={`h-4 w-4 ${rttColor}`} />
              ) : (
                <WifiOff className="h-4 w-4 animate-pulse text-destructive" />
              )}
              {isConnected && (
                <span className={`font-mono text-xs tabular-nums ${rttColor}`}>
                  {Math.round(rtt)}ms
                </span>
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {isConnected ? `已连接 · 延迟 ${Math.round(rtt)}ms` : '连接断开，正在重连...'}
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-center gap-0.5 sm:gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 min-h-11 min-w-11 sm:min-h-0 sm:min-w-0" onClick={onOpenSearch} aria-label="搜索点歌">
              <Search className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>搜索点歌</TooltipContent>
        </Tooltip>

        {/* Desktop: inline settings & leave buttons */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="hidden h-8 w-8 min-h-11 min-w-11 sm:flex sm:min-h-0 sm:min-w-0" onClick={onOpenSettings} aria-label="设置">
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>设置</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="hidden h-8 w-8 min-h-11 min-w-11 sm:flex sm:min-h-0 sm:min-w-0" onClick={onLeaveRoom} aria-label="离开房间">
              <LogOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>离开房间</TooltipContent>
        </Tooltip>

        {/* Mobile: dropdown menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 min-h-11 min-w-11 sm:hidden sm:min-h-0 sm:min-w-0" aria-label="更多操作">
              <Ellipsis className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onOpenSettings}>
              <Settings className="mr-2 h-4 w-4" />
              设置
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={copyRoomId}>
              <Copy className="mr-2 h-4 w-4" />
              复制房间号
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onLeaveRoom}
            >
              <LogOut className="mr-2 h-4 w-4" />
              离开房间
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
