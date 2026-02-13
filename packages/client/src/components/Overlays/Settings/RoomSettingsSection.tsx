import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useRoomStore } from '@/stores/roomStore'
import { LIMITS } from '@music-together/shared'
import { Copy, Crown, Lock, LockOpen, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { SettingRow } from './SettingRow'

interface RoomSettingsSectionProps {
  onUpdateSettings: (settings: {
    mode?: 'host-only' | 'collaborative'
    password?: string | null
  }) => void
}

export function RoomSettingsSection({ onUpdateSettings }: RoomSettingsSectionProps) {
  const room = useRoomStore((s) => s.room)
  const currentUser = useRoomStore((s) => s.currentUser)
  const isHost = currentUser?.isHost ?? false
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordEnabled, setPasswordEnabled] = useState(
    room?.hasPassword ?? false,
  )

  useEffect(() => {
    setPasswordEnabled(room?.hasPassword ?? false)
    setPasswordInput('')
  }, [room?.hasPassword])

  const copyRoomLink = () => {
    const url = `${window.location.origin}/room/${room?.id}`
    navigator.clipboard.writeText(url)
    toast.success('房间链接已复制')
  }

  const handlePasswordToggle = (checked: boolean) => {
    if (!checked) {
      setPasswordEnabled(false)
      setPasswordInput('')
      onUpdateSettings({ password: null })
      toast.success('密码已移除')
    } else {
      setPasswordEnabled(true)
    }
  }

  const handleSetPassword = () => {
    if (!passwordInput.trim()) {
      toast.error('请输入密码')
      return
    }
    onUpdateSettings({ password: passwordInput.trim() })
    toast.success('密码已设置')
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">房间信息</h3>
        <Separator className="mt-2 mb-4" />

        <SettingRow label="房间号">
          <div className="flex items-center gap-2">
            <code className="rounded bg-muted px-2 py-0.5 text-sm">
              {room?.id}
            </code>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={copyRoomLink}
                  aria-label="复制房间链接"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>复制房间链接</TooltipContent>
            </Tooltip>
          </div>
        </SettingRow>

        <SettingRow label="密码保护">
          {room?.hasPassword ? (
            <Badge variant="secondary" className="gap-1">
              <Lock className="h-3 w-3" /> 已设置
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <LockOpen className="h-3 w-3" /> 无密码
            </Badge>
          )}
        </SettingRow>
      </div>

      {isHost && (
        <div>
          <h3 className="text-base font-semibold">房主设置</h3>
          <Separator className="mt-2 mb-4" />

          <SettingRow label="权限模式" description="控制谁可以操作播放器">
            <Select
              value={room?.mode}
              onValueChange={(v) =>
                onUpdateSettings({
                  mode: v as 'host-only' | 'collaborative',
                })
              }
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="host-only">仅房主控制</SelectItem>
                <SelectItem value="collaborative">所有人可操作</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow label="房间密码" description="开启后需输入密码才能进入">
            <Switch
              checked={passwordEnabled}
              onCheckedChange={handlePasswordToggle}
            />
          </SettingRow>

          {passwordEnabled && (
            <div className="flex gap-2 pb-2">
              <Input
                type="password"
                placeholder="输入新密码..."
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                maxLength={LIMITS.ROOM_PASSWORD_MAX_LENGTH}
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleSetPassword()}
              />
              <Button size="sm" onClick={handleSetPassword}>
                确认
              </Button>
            </div>
          )}
        </div>
      )}

      <div>
        <h3 className="text-base font-semibold">
          在线用户 ({room?.users.length ?? 0})
        </h3>
        <Separator className="mt-2 mb-4" />

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
      </div>
    </div>
  )
}
