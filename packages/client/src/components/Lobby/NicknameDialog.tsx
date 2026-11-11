import { useState } from 'react'
import { UserRound } from 'lucide-react'
import { LIMITS } from '@music-together/shared'
import {
  DIALOG_BAR_CLASS,
  DIALOG_BODY_CLASS,
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { storage } from '@/lib/storage'

interface NicknameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (nickname: string) => void
}

export function NicknameDialog({ open, onOpenChange, onConfirm }: NicknameDialogProps) {
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
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent className="gap-0 p-0 sm:max-w-sm">
        <ResponsiveDialogHeader className={DIALOG_BAR_CLASS}>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-primary" />
            设置昵称
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className={DIALOG_BODY_CLASS}>
          <ResponsiveDialogDescription className="text-muted-foreground mb-4 text-sm">
            加入房间前，请先设置你的昵称
          </ResponsiveDialogDescription>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nickname-input">昵称</Label>
              <Input
                id="nickname-input"
                placeholder="你的昵称..."
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={LIMITS.NICKNAME_MAX_LENGTH}
                autoFocus
              />
            </div>

            <Button type="submit" className="w-full" disabled={!nickname.trim()}>
              确认并加入
            </Button>
          </form>
        </ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
