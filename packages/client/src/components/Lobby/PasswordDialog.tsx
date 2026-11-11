import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DIALOG_BAR_CLASS,
  DIALOG_BODY_CLASS,
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
import { cn } from '@/lib/utils'
import { Loader2, Lock } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'

interface PasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  roomName: string
  onSubmit: (password: string) => void
  error: string | null
  isLoading: boolean
}

export function PasswordDialog({ open, onOpenChange, roomName, onSubmit, error, isLoading }: PasswordDialogProps) {
  const [password, setPassword] = useState('')

  // Reset password when dialog opens
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setPassword('')
    onOpenChange(nextOpen)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) return
    onSubmit(password.trim())
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent className="gap-0 p-0 sm:max-w-sm">
        <ResponsiveDialogHeader className={DIALOG_BAR_CLASS}>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            需要密码
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className={cn(DIALOG_BODY_CLASS, 'space-y-4')}>
          <p className="text-sm text-muted-foreground">房间「{roomName}」已设置密码保护</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <motion.div animate={error ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}} transition={{ duration: 0.5 }}>
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

            <Button type="submit" className="w-full" disabled={isLoading || !password.trim()}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              加入房间
            </Button>
          </form>
        </ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
