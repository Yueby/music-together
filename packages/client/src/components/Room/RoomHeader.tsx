import { Copy, Search, Settings, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useRoomStore } from '@/stores/roomStore'
import { toast } from 'sonner'

interface RoomHeaderProps {
  onOpenSearch: () => void
  onOpenSettings: () => void
}

export function RoomHeader({ onOpenSearch, onOpenSettings }: RoomHeaderProps) {
  const room = useRoomStore((s) => s.room)

  const copyRoomId = () => {
    if (room?.id) {
      navigator.clipboard.writeText(room.id)
      toast.success('房间号已复制')
    }
  }

  return (
    <header className="flex items-center justify-between border-b px-4 py-2">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold">Music Together</h1>
        {room && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-xs font-mono"
              onClick={copyRoomId}
            >
              {room.id}
              <Copy className="h-3 w-3" />
            </Button>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {room.users.length}人在线
            </span>
          </>
        )}
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
      </div>
    </header>
  )
}
