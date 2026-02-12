import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { Lock, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface PasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  roomName: string
  onSubmit: (password: string) => void
  error: string | null
  isLoading: boolean
}

export function PasswordDialog({
  open,
  onOpenChange,
  roomName,
  onSubmit,
  error,
  isLoading,
}: PasswordDialogProps) {
  const [password, setPassword] = useState('')

  // Reset password input each time dialog opens
  useEffect(() => {
    if (open) setPassword('')
  }, [open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) return
    onSubmit(password.trim())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-5 w-5 text-muted-foreground" />
            需要密码
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          房间「{roomName}」已设置密码保护
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <motion.div
            animate={error ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
            transition={{ duration: 0.5 }}
          >
            <Input
              type="password"
              placeholder="输入房间密码..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className={error ? 'border-destructive' : ''}
            />
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-1.5 text-xs text-destructive"
              >
                {error}
              </motion.p>
            )}
          </motion.div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !password.trim()}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            加入房间
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
