import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { MusicSource, MyPlatformAuth, PlatformAuthStatus } from '@music-together/shared'
import { Crown, KeyRound, Loader2, LogOut, ScanLine } from 'lucide-react'

const VIP_LABELS: Record<number, string> = {
  0: '',
  // Netease: 1=VIP, 10/11=黑胶VIP
  1: 'VIP',
  10: '黑胶VIP',
  11: '黑胶VIP',
  // Kugou: vip_type values
  2: '豪华VIP',
  3: '超级VIP',
}

interface LoginSectionProps {
  platform: MusicSource
  status?: PlatformAuthStatus
  myStatus?: MyPlatformAuth
  /** localStorage has a cookie for this platform but server hasn't confirmed yet */
  isVerifying?: boolean
  onQrLogin: () => void
  onCookieLogin: () => void
  onLogout: () => void
}

export function LoginSection({
  platform,
  status,
  myStatus,
  isVerifying,
  onQrLogin,
  onCookieLogin,
  onLogout,
}: LoginSectionProps) {
  const loggedInCount = status?.loggedInCount ?? 0
  const hasVip = status?.hasVip ?? false
  const maxVipType = status?.maxVipType ?? 0
  const isMyLoggedIn = myStatus?.loggedIn ?? false

  return (
    <div className="flex items-center justify-between gap-2 overflow-hidden rounded-lg border p-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex min-w-0 items-center gap-2">
          {isMyLoggedIn && myStatus?.nickname ? (
            <span className="truncate text-sm font-medium">{myStatus.nickname}</span>
          ) : isVerifying ? (
            <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-sm">
              <Loader2 className="h-3 w-3 animate-spin" />
              验证登录中…
            </span>
          ) : (
            <span className="text-muted-foreground shrink-0 text-sm">未登录</span>
          )}
          {hasVip && (
            <Badge variant="secondary" className="shrink-0 gap-1 text-xs">
              <Crown className="h-3 w-3" />
              {VIP_LABELS[maxVipType] || 'VIP'}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground truncate text-xs">
          {loggedInCount > 0 ? `房间内 ${loggedInCount} 人已登录${hasVip ? '，VIP 可用' : ''}` : '房间暂无人登录此平台'}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {!isMyLoggedIn && !isVerifying ? (
          <>
            {(platform === 'netease' || platform === 'kugou' || platform === 'tencent') && (
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={onQrLogin} title="扫码登录">
                <ScanLine className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={onCookieLogin} title="Cookie 登录">
              <KeyRound className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : isMyLoggedIn ? (
          <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={onLogout} title="登出">
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
