import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { storage } from '@/lib/storage'
import { cn } from '@/lib/utils'
import { useRoomStore } from '@/stores/roomStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { LIMITS } from '@music-together/shared'
import {
  Copy,
  Crown,
  Lock,
  LockOpen,
  Music,
  Palette,
  Settings2,
  User,
  UserCog,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'room' | 'profile' | 'lyrics' | 'other'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdateSettings: (settings: {
    mode?: 'host-only' | 'collaborative'
    password?: string | null
  }) => void
}

// ---------------------------------------------------------------------------
// Nav Item
// ---------------------------------------------------------------------------

function NavItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Setting Row helper
// ---------------------------------------------------------------------------

function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Room Settings Section
// ---------------------------------------------------------------------------

function RoomSettingsSection({
  onUpdateSettings,
}: {
  onUpdateSettings: SettingsDialogProps['onUpdateSettings']
}) {
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

// ---------------------------------------------------------------------------
// Lyrics Settings Section
// ---------------------------------------------------------------------------

function LyricsSettingsSection() {
  const lyricAlignAnchor = useSettingsStore((s) => s.lyricAlignAnchor)
  const lyricAlignPosition = useSettingsStore((s) => s.lyricAlignPosition)
  const lyricEnableSpring = useSettingsStore((s) => s.lyricEnableSpring)
  const lyricEnableBlur = useSettingsStore((s) => s.lyricEnableBlur)
  const lyricEnableScale = useSettingsStore((s) => s.lyricEnableScale)
  const lyricFontWeight = useSettingsStore((s) => s.lyricFontWeight)
  const setLyricAlignAnchor = useSettingsStore((s) => s.setLyricAlignAnchor)
  const setLyricAlignPosition = useSettingsStore((s) => s.setLyricAlignPosition)
  const setLyricEnableSpring = useSettingsStore((s) => s.setLyricEnableSpring)
  const setLyricEnableBlur = useSettingsStore((s) => s.setLyricEnableBlur)
  const setLyricEnableScale = useSettingsStore((s) => s.setLyricEnableScale)
  const setLyricFontWeight = useSettingsStore((s) => s.setLyricFontWeight)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">歌词对齐</h3>
        <Separator className="mt-2 mb-4" />

        <SettingRow label="对齐锚点" description="当前歌词行在视口中的锚定方式">
          <Select
            value={lyricAlignAnchor}
            onValueChange={(v) =>
              setLyricAlignAnchor(v as 'top' | 'center' | 'bottom')
            }
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top">顶部</SelectItem>
              <SelectItem value="center">居中</SelectItem>
              <SelectItem value="bottom">底部</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow
          label="对齐位置"
          description={`当前: ${Math.round(lyricAlignPosition * 100)}%`}
        >
          <Slider
            value={[lyricAlignPosition * 100]}
            min={0}
            max={100}
            step={5}
            onValueChange={(v) => setLyricAlignPosition(v[0] / 100)}
            className="w-32"
          />
        </SettingRow>
      </div>

      <div>
        <h3 className="text-base font-semibold">歌词动画</h3>
        <Separator className="mt-2 mb-4" />

        <SettingRow label="弹簧动画" description="歌词行切换时的弹簧物理效果">
          <Switch
            checked={lyricEnableSpring}
            onCheckedChange={setLyricEnableSpring}
          />
        </SettingRow>

        <SettingRow label="模糊效果" description="非当前行歌词模糊">
          <Switch
            checked={lyricEnableBlur}
            onCheckedChange={setLyricEnableBlur}
          />
        </SettingRow>

        <SettingRow label="缩放效果" description="当前行歌词放大突出显示">
          <Switch
            checked={lyricEnableScale}
            onCheckedChange={setLyricEnableScale}
          />
        </SettingRow>
      </div>

      <div>
        <h3 className="text-base font-semibold">字体</h3>
        <Separator className="mt-2 mb-4" />

        <SettingRow label="字体粗细">
          <Select
            value={String(lyricFontWeight)}
            onValueChange={(v) => setLyricFontWeight(parseInt(v, 10))}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="400">常规</SelectItem>
              <SelectItem value="500">中等</SelectItem>
              <SelectItem value="600">半粗</SelectItem>
              <SelectItem value="700">粗体</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Profile Settings Section
// ---------------------------------------------------------------------------

function ProfileSettingsSection() {
  const [nickname, setNickname] = useState(storage.getNickname())

  const handleNicknameBlur = () => {
    const trimmed = nickname.trim()
    if (trimmed) {
      storage.setNickname(trimmed)
      toast.success('昵称已保存（下次加入房间生效）')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">个人信息</h3>
        <Separator className="mt-2 mb-4" />

        <SettingRow label="昵称" description="修改后下次加入房间生效">
          <Input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onBlur={handleNicknameBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleNicknameBlur()}
            className="w-40"
            placeholder="输入昵称..."
          />
        </SettingRow>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Other Settings Section
// ---------------------------------------------------------------------------

function OtherSettingsSection() {
  const bgFps = useSettingsStore((s) => s.bgFps)
  const bgFlowSpeed = useSettingsStore((s) => s.bgFlowSpeed)
  const bgRenderScale = useSettingsStore((s) => s.bgRenderScale)
  const setBgFps = useSettingsStore((s) => s.setBgFps)
  const setBgFlowSpeed = useSettingsStore((s) => s.setBgFlowSpeed)
  const setBgRenderScale = useSettingsStore((s) => s.setBgRenderScale)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">背景渲染</h3>
        <Separator className="mt-2 mb-4" />

        <SettingRow label="帧率" description="更高帧率更流畅，但消耗更多性能">
          <Select
            value={String(bgFps)}
            onValueChange={(v) => setBgFps(parseInt(v, 10))}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 FPS</SelectItem>
              <SelectItem value="30">30 FPS</SelectItem>
              <SelectItem value="60">60 FPS</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow
          label="流动速度"
          description={`当前: ${bgFlowSpeed.toFixed(1)}`}
        >
          <Slider
            value={[bgFlowSpeed * 10]}
            min={5}
            max={50}
            step={5}
            onValueChange={(v) => setBgFlowSpeed(v[0] / 10)}
            className="w-32"
          />
        </SettingRow>

        <SettingRow label="渲染精度" description="更低精度更省性能">
          <Select
            value={String(bgRenderScale)}
            onValueChange={(v) => setBgRenderScale(parseFloat(v))}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0.25">25%</SelectItem>
              <SelectItem value="0.5">50%</SelectItem>
              <SelectItem value="0.75">75%</SelectItem>
              <SelectItem value="1">100%</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Dialog
// ---------------------------------------------------------------------------

export function SettingsDialog({
  open,
  onOpenChange,
  onUpdateSettings,
}: SettingsDialogProps) {
  const [tab, setTab] = useState<Tab>('room')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[85vw] md:max-w-[75vw] lg:max-w-[60vw] gap-0 p-0">
        <DialogDescription className="sr-only">
          调整房间、歌词和其他设置
        </DialogDescription>
        <div className="flex h-[60vh] md:h-[70vh]">
          {/* Left nav */}
          <nav className="flex w-40 shrink-0 flex-col border-r p-4 md:w-48">
            <DialogTitle className="mb-4 px-3 text-lg font-semibold">
              设置
            </DialogTitle>
            <div className="space-y-1">
              <NavItem
                icon={Settings2}
                label="房间"
                active={tab === 'room'}
                onClick={() => setTab('room')}
              />
              <NavItem
                icon={UserCog}
                label="个人"
                active={tab === 'profile'}
                onClick={() => setTab('profile')}
              />
              <NavItem
                icon={Music}
                label="歌词"
                active={tab === 'lyrics'}
                onClick={() => setTab('lyrics')}
              />
              <NavItem
                icon={Palette}
                label="其他"
                active={tab === 'other'}
                onClick={() => setTab('other')}
              />
            </div>
          </nav>

          {/* Right content */}
          <ScrollArea className="flex-1">
            <div className="p-6">
              {tab === 'room' && (
                <RoomSettingsSection onUpdateSettings={onUpdateSettings} />
              )}
              {tab === 'profile' && <ProfileSettingsSection />}
              {tab === 'lyrics' && <LyricsSettingsSection />}
              {tab === 'other' && <OtherSettingsSection />}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
