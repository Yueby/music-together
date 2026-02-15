import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { usePlayerStore } from '@/stores/playerStore'
import { useRoomStore } from '@/stores/roomStore'
import type { AudioQuality } from '@music-together/shared'
import { LIMITS } from '@music-together/shared'
import { Check, Copy, Lock, LockOpen, Pencil, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { SettingRow } from './SettingRow'

const QUALITY_OPTIONS: { value: AudioQuality; label: string; description?: string }[] = [
  { value: 128, label: '标准 128kbps' },
  { value: 192, label: '较高 192kbps' },
  { value: 320, label: 'HQ 320kbps' },
  { value: 999, label: '无损 SQ', description: '需要 VIP 账号' },
]

function getQualityLabel(quality: AudioQuality): string {
  return QUALITY_OPTIONS.find((o) => o.value === quality)?.label ?? `${quality}kbps`
}

interface RoomSettingsSectionProps {
  onUpdateSettings: (settings: {
    name?: string
    password?: string | null
    audioQuality?: AudioQuality
  }) => void
}

export function RoomSettingsSection({ onUpdateSettings }: RoomSettingsSectionProps) {
  const room = useRoomStore((s) => s.room)
  const currentUser = useRoomStore((s) => s.currentUser)
  const syncDrift = usePlayerStore((s) => s.syncDrift)
  const isHost = currentUser?.role === 'host'

  const driftDisplay = useMemo(() => {
    const ms = Math.round(syncDrift * 1000)
    const label = ms > 0 ? `+${ms}ms` : `${ms}ms`
    const isHigh = Math.abs(ms) > 500
    return { label, isHigh }
  }, [syncDrift])
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordEnabled, setPasswordEnabled] = useState(
    room?.hasPassword ?? false,
  )

  // Room name editing state
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')

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

  const handleStartEditName = () => {
    setNameInput(room?.name ?? '')
    setEditingName(true)
  }

  const handleSaveName = () => {
    const trimmed = nameInput.trim()
    if (!trimmed) {
      toast.error('房间名不能为空')
      return
    }
    if (trimmed === room?.name) {
      setEditingName(false)
      return
    }
    onUpdateSettings({ name: trimmed })
    setEditingName(false)
    toast.success('房间名已更新')
  }

  const handleCancelEditName = () => {
    setEditingName(false)
    setNameInput('')
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">房间信息</h3>
        <Separator className="mt-2 mb-4" />

        <SettingRow label="房间名">
          {editingName ? (
            <div className="flex items-center gap-1.5">
              <Input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={LIMITS.ROOM_NAME_MAX_LENGTH}
                className="h-7 w-40 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName()
                  if (e.key === 'Escape') handleCancelEditName()
                }}
                autoFocus
              />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveName}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancelEditName}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{room?.name}</span>
              {isHost && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleStartEditName} aria-label="编辑房间名">
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </SettingRow>

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

        <SettingRow label="同步偏移">
          <span className={`text-sm font-mono ${driftDisplay.isHigh ? 'text-yellow-500' : 'text-muted-foreground'}`}>
            {driftDisplay.label}
          </span>
        </SettingRow>

        <SettingRow label="音质" description={isHost ? '切换后对下一首歌生效' : undefined}>
          {isHost ? (
            <Select
              value={String(room?.audioQuality ?? 320)}
              onValueChange={(v) => {
                const quality = Number(v) as AudioQuality
                onUpdateSettings({ audioQuality: quality })
                toast.success(`音质已切换为 ${getQualityLabel(quality)}`)
              }}
            >
              <SelectTrigger className="h-8 w-[145px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUALITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    <div className="flex items-center gap-2">
                      <span>{opt.label}</span>
                      {opt.description && (
                        <span className="text-[10px] text-muted-foreground">({opt.description})</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm text-muted-foreground">
              {getQualityLabel(room?.audioQuality ?? 320)}
            </span>
          )}
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
    </div>
  )
}
