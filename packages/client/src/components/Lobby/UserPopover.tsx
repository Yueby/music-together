import { useRef, useState } from 'react'
import { CircleUser } from 'lucide-react'
import { LIMITS } from '@music-together/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { storage } from '@/lib/storage'
import { toast } from 'sonner'

export function UserPopover() {
  const [nickname, setNickname] = useState(storage.getNickname())
  const [open, setOpen] = useState(false)
  const prevValueRef = useRef(storage.getNickname())

  const handleSave = () => {
    const trimmed = nickname.trim()
    if (!trimmed) return
    // Only save and toast when value actually changed
    if (trimmed !== prevValueRef.current) {
      storage.setNickname(trimmed)
      prevValueRef.current = trimmed
      toast.success('昵称已保存')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    }
  }

  // Sync from storage when popover opens
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      const current = storage.getNickname()
      setNickname(current)
      prevValueRef.current = current
    }
    setOpen(nextOpen)
  }

  const savedNickname = storage.getNickname()
  const initial = savedNickname ? savedNickname.charAt(0).toUpperCase() : null

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full border border-border/60">
          {initial ? <span className="text-sm font-semibold">{initial}</span> : <CircleUser className="h-5 w-5" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">个人设置</p>
            <p className="text-xs text-muted-foreground">
              {savedNickname ? `当前昵称: ${savedNickname}` : '尚未设置昵称'}
            </p>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">昵称</label>
            <Input
              placeholder="输入昵称..."
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              maxLength={LIMITS.NICKNAME_MAX_LENGTH}
              className="h-8 text-sm"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
