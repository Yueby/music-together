import { m, useReducedMotion } from 'motion/react'
import { Headphones, Loader2, Lock, UserRound } from 'lucide-react'
import { LIMITS } from '@music-together/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRef, useState } from 'react'
import { storage } from '@/lib/storage'

interface InteractionGateProps {
  onStart: (password?: string) => void | Promise<void>
  roomName?: string
  hasPassword?: boolean
  passwordError?: string | null
}

export function InteractionGate({ onStart, roomName, hasPassword, passwordError }: InteractionGateProps) {
  const prefersReducedMotion = useReducedMotion()
  const [password, setPassword] = useState('')
  const [starting, setStarting] = useState(false)
  const startingRef = useRef(false)

  const savedNickname = storage.getNickname()
  const needsNickname = !savedNickname
  const [nickname, setNickname] = useState(savedNickname)

  const canStart = (!needsNickname || nickname.trim().length > 0) && (!hasPassword || password.trim().length > 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canStart || startingRef.current) return
    startingRef.current = true
    setStarting(true)
    if (needsNickname) {
      storage.setNickname(nickname.trim())
    }
    try {
      await onStart(hasPassword ? password.trim() : undefined)
    } catch {
      // Caller surfaces errors (e.g. via passwordError or toast); avoid unhandled promise rejections.
    } finally {
      startingRef.current = false
      setStarting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background px-4">
      <m.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl border border-border bg-card p-10 shadow-lg"
      >
        <m.div
          animate={prefersReducedMotion ? {} : { rotate: [0, 5, -5, 0] }}
          transition={prefersReducedMotion ? {} : { duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Headphones className="h-16 w-16 text-primary" />
        </m.div>

        <div className="flex flex-col items-center gap-1.5">
          <h2 className="text-xl font-semibold">准备就绪</h2>
          {roomName ? (
            <p className="text-sm text-muted-foreground">即将加入「{roomName}」</p>
          ) : (
            <p className="text-sm text-muted-foreground">点击开始，与房间好友一起听歌</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
          {needsNickname && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="gate-nickname" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <UserRound className="h-3.5 w-3.5" />
                <span>设置你的昵称</span>
              </Label>
              <Input
                id="gate-nickname"
                placeholder="你的昵称..."
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={LIMITS.NICKNAME_MAX_LENGTH}
                disabled={starting}
                autoFocus
              />
            </div>
          )}

          {hasPassword && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />
                <span>该房间需要密码</span>
              </div>
              <m.div animate={passwordError ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}} transition={{ duration: 0.5 }}>
                <Input
                  type="password"
                  placeholder="输入房间密码..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={starting}
                  autoFocus={!needsNickname}
                  className={passwordError ? 'border-destructive' : ''}
                />
                {passwordError && (
                  <m.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-1.5 text-xs text-destructive"
                  >
                    {passwordError}
                  </m.p>
                )}
              </m.div>
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!canStart || starting}
            aria-busy={starting || undefined}
            aria-label={starting ? '正在进入' : '开始收听'}
          >
            {starting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                正在进入...
              </>
            ) : (
              '开始收听'
            )}
          </Button>
        </form>
      </m.div>
    </div>
  )
}
