import { useState } from 'react'
import { UserRound } from 'lucide-react'
import { LIMITS } from '@music-together/shared'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { storage } from '@/lib/storage'

interface NicknameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (nickname: string) => void
}

export function NicknameDialog({
  open,
  onOpenChange,
  onConfirm,
}: NicknameDialogProps) {
  const [nickname, setNickname] = useState(storage.getNickname())

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = nickname.trim()
    if (!trimmed) return
    storage.setNickname(trimmed)
    onConfirm(trimmed)
  }

  // Sync from storage every time the dialog opens
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setNickname(storage.getNickname())
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <UserRound className="h-5 w-5 text-primary" />
            设置昵称
          </DialogTitle>
          <DialogDescription>
            加入房间前，请先设置你的昵称
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">
              昵称
            </label>
            <Input
              placeholder="你的昵称..."
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={LIMITS.NICKNAME_MAX_LENGTH}
              autoFocus
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={!nickname.trim()}
          >
            确认并加入
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
