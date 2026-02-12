import { Copy, Crown, User } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useRoomStore } from '@/stores/roomStore'
import { toast } from 'sonner'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdateMode: (mode: 'host-only' | 'collaborative') => void
}

export function SettingsDialog({ open, onOpenChange, onUpdateMode }: SettingsDialogProps) {
  const room = useRoomStore((s) => s.room)
  const currentUser = useRoomStore((s) => s.currentUser)
  const isHost = currentUser?.isHost ?? false

  const copyRoomLink = () => {
    const url = `${window.location.origin}/room/${room?.id}`
    navigator.clipboard.writeText(url)
    toast.success('房间链接已复制')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>房间设置</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Room Info */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">房间信息</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">房间号:</span>
              <code className="rounded bg-muted px-2 py-0.5 text-sm">{room?.id}</code>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyRoomLink}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Permission Mode */}
          {isHost && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">权限模式</h3>
              <div className="flex gap-2">
                <Button
                  variant={room?.mode === 'host-only' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onUpdateMode('host-only')}
                >
                  仅房主控制
                </Button>
                <Button
                  variant={room?.mode === 'collaborative' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onUpdateMode('collaborative')}
                >
                  所有人可操作
                </Button>
              </div>
            </div>
          )}

          {/* Online Users */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">在线用户 ({room?.users.length ?? 0})</h3>
            <ScrollArea className="h-40">
              <div className="space-y-1">
                {room?.users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-2 rounded-lg px-3 py-1.5"
                  >
                    {user.isHost ? (
                      <Crown className="h-4 w-4 text-yellow-500" />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">{user.nickname}</span>
                    {user.id === currentUser?.id && (
                      <Badge variant="secondary" className="text-xs">
                        你
                      </Badge>
                    )}
                    {user.isHost && (
                      <Badge variant="outline" className="text-xs">
                        房主
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
