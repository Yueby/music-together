import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Lock, Music, Loader2 } from 'lucide-react'
import { LIMITS } from '@music-together/shared'
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

interface CreateRoomDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateRoom: (nickname: string, roomName?: string, password?: string) => void
  defaultNickname: string
  isLoading: boolean
}

export function CreateRoomDialog({
  open,
  onOpenChange,
  onCreateRoom,
  defaultNickname,
  isLoading,
}: CreateRoomDialogProps) {
  const [nickname, setNickname] = useState(defaultNickname)
  const [roomName, setRoomName] = useState('')
  const [passwordEnabled, setPasswordEnabled] = useState(false)
  const [password, setPassword] = useState('')

  // Sync nickname from defaultNickname when the dialog opens
  useEffect(() => {
    if (open) {
      setNickname(defaultNickname)
    }
  }, [open, defaultNickname])

  const canSubmit = nickname.trim() && !(passwordEnabled && !password.trim())

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    onCreateRoom(
      nickname.trim(),
      roomName.trim() || undefined,
      passwordEnabled && password.trim() ? password.trim() : undefined,
    )
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2 text-lg">
            <Music className="h-5 w-5 text-primary" />
            创建房间
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground/80">昵称</Label>
            <Input
              placeholder="你的昵称..."
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={LIMITS.NICKNAME_MAX_LENGTH}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground/80">房间名 (可选)</Label>
            <Input
              placeholder="给房间起个名字..."
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              maxLength={LIMITS.ROOM_NAME_MAX_LENGTH}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Switch
                id="password-toggle"
                checked={passwordEnabled}
                onCheckedChange={setPasswordEnabled}
              />
              <Label
                htmlFor="password-toggle"
                className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground"
              >
                <Lock className="h-3.5 w-3.5" />
                设置密码
              </Label>
            </div>

            <AnimatePresence>
              {passwordEnabled && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <Input
                    type="password"
                    placeholder="设置房间密码..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    maxLength={LIMITS.ROOM_PASSWORD_MAX_LENGTH}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isLoading || !canSubmit}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            创建房间
          </Button>
        </form>
        </ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
