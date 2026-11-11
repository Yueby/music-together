import { Card, CardContent } from '@/components/ui/card'
import { PLATFORM_LABELS } from '@/lib/platform'
import type { MusicSource } from '@music-together/shared'
import { UserRound } from 'lucide-react'
import { LoginActions } from './LoginActions'

interface LoginBannerProps {
  platform: MusicSource
  /** Whether the platform has the personal recommendations (daily songs) this login unlocks. */
  withRecommendations: boolean
  onQrLogin: () => void
  onCookieLogin: () => void
}

/**
 * The page's one place to sign in. The blocks that need an account only say so (no buttons of their own), so there is
 * a single set of sign-in buttons on the page.
 */
export function LoginBanner({ platform, withRecommendations, onQrLogin, onCookieLogin }: LoginBannerProps) {
  const name = PLATFORM_LABELS[platform]
  return (
    <Card className="shrink-0 gap-0 py-0 shadow-none">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground flex min-w-0 items-start gap-2 text-sm sm:items-center">
          <UserRound aria-hidden className="mt-0.5 size-4 shrink-0 sm:mt-0" />
          <span>
            登录{name}，查看{withRecommendations ? '每日推荐和' : ''}自己的歌单，VIP 歌曲也能点播
          </span>
        </p>
        <LoginActions className="flex shrink-0 flex-wrap gap-2" onQrLogin={onQrLogin} onCookieLogin={onCookieLogin} />
      </CardContent>
    </Card>
  )
}
