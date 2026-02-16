import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/hooks/useAuth'
import type { MusicSource, MyPlatformAuth, PlatformAuthStatus } from '@music-together/shared'
import { Crown, KeyRound, LogOut, ScanLine } from 'lucide-react'
import { useState } from 'react'
import { ManualCookieDialog } from './ManualCookieDialog'
import { QrLoginDialog } from './QrLoginDialog'

const PLATFORM_LABELS: Record<MusicSource, string> = {
  netease: '网易云音乐',
  tencent: 'QQ 音乐',
  kugou: '酷狗音乐',
}

const VIP_LABELS: Record<number, string> = {
  0: '',
  1: 'VIP',
  10: '黑胶VIP',
  11: '黑胶VIP',
}

function getPlatformStatus(platform: MusicSource, statusList: PlatformAuthStatus[]): PlatformAuthStatus | undefined {
  return statusList.find((s) => s.platform === platform)
}

function getMyPlatformStatus(platform: MusicSource, myStatusList: MyPlatformAuth[]): MyPlatformAuth | undefined {
  return myStatusList.find((s) => s.platform === platform)
}

// ---------------------------------------------------------------------------
// Platform row
// ---------------------------------------------------------------------------

function PlatformRow({
  platform,
  status,
  myStatus,
  onQrLogin,
  onCookieLogin,
  onLogout,
}: {
  platform: MusicSource
  status?: PlatformAuthStatus
  myStatus?: MyPlatformAuth
  onQrLogin: (platform: MusicSource) => void
  onCookieLogin: () => void
  onLogout: () => void
}) {
  const loggedInCount = status?.loggedInCount ?? 0
  const hasVip = status?.hasVip ?? false
  const maxVipType = status?.maxVipType ?? 0
  const isMyLoggedIn = myStatus?.loggedIn ?? false

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{PLATFORM_LABELS[platform]}</span>
          {hasVip && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <Crown className="h-3 w-3" />
              {VIP_LABELS[maxVipType] || 'VIP'}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {loggedInCount > 0
            ? `${loggedInCount} 人已登录${hasVip ? '，VIP 可用' : ''}`
            : '暂无人登录'}
          {isMyLoggedIn && myStatus?.nickname && (
            <span className="text-foreground ml-1">（我：{myStatus.nickname}）</span>
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {!isMyLoggedIn ? (
          <>
            {(platform === 'netease' || platform === 'kugou') && (
              <Button variant="outline" size="sm" onClick={() => onQrLogin(platform)} className="gap-1">
                <ScanLine className="h-3.5 w-3.5" />
                扫码
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onCookieLogin} className="gap-1">
              <KeyRound className="h-3.5 w-3.5" />
              Cookie
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={onLogout} className="text-destructive gap-1">
            <LogOut className="h-3.5 w-3.5" />
            登出
          </Button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main section
// ---------------------------------------------------------------------------

export function PlatformAuthSection() {
  const auth = useAuth()
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [cookieDialogOpen, setCookieDialogOpen] = useState(false)
  const [cookieDialogPlatform, setCookieDialogPlatform] = useState<MusicSource>('netease')

  const platforms: MusicSource[] = ['netease', 'tencent', 'kugou']

  // NOTE: This legacy component is replaced by PlatformHub. Kept for backward compat.
  const handleQrLogin = (platform: MusicSource) => {
    auth.requestQrCode(platform)
    setQrDialogOpen(true)
  }

  const handleCookieLogin = (platform: MusicSource) => {
    setCookieDialogPlatform(platform)
    setCookieDialogOpen(true)
  }

  const handleCookieSubmit = (cookie: string) => {
    auth.setCookie(cookieDialogPlatform, cookie)
    setCookieDialogOpen(false)
  }

  return (
    <div className="space-y-1">
      <h3 className="text-base font-semibold">平台账号</h3>
      <Separator className="mt-2 mb-4" />
      <p className="text-muted-foreground mb-4 text-xs">
        登录音乐平台 VIP 账号后，房间内所有人都可以播放 VIP 歌曲
      </p>

      {platforms.map((platform, i) => (
        <div key={platform}>
          {i > 0 && <Separator />}
          <PlatformRow
            platform={platform}
            status={getPlatformStatus(platform, auth.platformStatus)}
            myStatus={getMyPlatformStatus(platform, auth.myStatus)}
            onQrLogin={(p) => handleQrLogin(p)}
            onCookieLogin={() => handleCookieLogin(platform)}
            onLogout={() => auth.logout(platform)}
          />
        </div>
      ))}

      {/* QR Dialog */}
      <QrLoginDialog
        open={qrDialogOpen}
        onOpenChange={(open: boolean) => {
          setQrDialogOpen(open)
          if (!open) auth.resetQr()
        }}
        platform={auth.qrPlatform}
        qrData={auth.qrData}
        qrStatus={auth.qrStatus}
        isLoading={auth.isQrLoading}
        onRefresh={() => auth.requestQrCode(auth.qrPlatform)}
        onCheckStatus={(key: string) => auth.checkQrStatus(key)}
      />

      {/* Manual Cookie Dialog */}
      <ManualCookieDialog
        open={cookieDialogOpen}
        onOpenChange={setCookieDialogOpen}
        platform={cookieDialogPlatform}
        onSubmit={handleCookieSubmit}
      />
    </div>
  )
}
