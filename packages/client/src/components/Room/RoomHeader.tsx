import { Copy, LogOut, Search, Settings, Users, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useRoomStore } from '@/stores/roomStore'
import { useSocketContext } from '@/providers/SocketProvider'
import { toast } from 'sonner'

interface RoomHeaderProps {
  onOpenSearch: () => void
  onOpenSettings: () => void
  onLeaveRoom: () => void
}

export function RoomHeader({ onOpenSearch, onOpenSettings, onLeaveRoom }: RoomHeaderProps) {
  const room = useRoomStore((s) => s.room)
  const { isConnected } = useSocketContext()

  const copyRoomId = () => {
    if (room?.id) {
      navigator.clipboard.writeText(room.id)
      toast.success('房间号已复制')
    }
  }

  return (
    <header className="flex items-center justify-between border-b border-border/50 bg-background/95 px-4 py-2 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-foreground">Music Together</h1>
        {room && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs font-mono border-border/50"
                  onClick={copyRoomId}
                >
                  {room.id}
                  <Copy className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>复制房间号</TooltipContent>
            </Tooltip>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {room.users.length}
            </span>
          </>
        )}
        {/* Connection status indicator */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex items-center">
              {isConnected ? (
                <Wifi className="h-3.5 w-3.5 text-green-400/60" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-destructive animate-pulse" />
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {isConnected ? '已连接' : '连接断开，正在重连...'}
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onOpenSearch}>
              <Search className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>搜索点歌</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onOpenSettings}>
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>设置</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/60 hover:text-destructive" onClick={onLeaveRoom}>
              <LogOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>离开房间</TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}
