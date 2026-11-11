import { ArtworkImage } from '@/components/ArtworkImage'
import { PlatformSelect } from '@/components/PlatformSelect'
import { VipBadge } from '@/components/VipBadge'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import type { AccountSession } from '@/hooks/useAccountSession'
import { PLATFORM_LABELS, vipLabel } from '@/lib/platform'
import { Crown, Loader2, LogOut, UserRound } from 'lucide-react'
import { useState } from 'react'
import { LoginActions } from './LoginActions'

type AccountMenuProps = Pick<
  AccountSession,
  'platform' | 'setPlatform' | 'myStatus' | 'roomStatus' | 'verifying' | 'startQrLogin' | 'setCookieOpen' | 'logout'
>

/**
 * Top-right of the account dialog: the platform dropdown and the signed-in account's avatar. The avatar opens a card
 * with the account (name, membership badge) and its sign-in / sign-out actions.
 */
export function AccountMenu({
  platform,
  setPlatform,
  myStatus,
  roomStatus,
  verifying,
  startQrLogin,
  setCookieOpen,
  logout,
}: AccountMenuProps) {
  const [open, setOpen] = useState(false)
  const loggedIn = myStatus?.loggedIn ?? false
  const hasVip = loggedIn && vipLabel(platform, myStatus?.vipType) !== ''
  const platformName = PLATFORM_LABELS[platform]

  const roomCount = roomStatus?.loggedInCount ?? 0
  const roomLine =
    roomCount > 0 ? `房间内 ${roomCount} 人已登录${roomStatus?.hasVip ? '，VIP 可用' : ''}` : '房间暂无人登录此平台'

  return (
    <div className="flex shrink-0 items-center gap-2">
      <PlatformSelect value={platform} onChange={setPlatform} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={loggedIn ? `${platformName}账号：${myStatus?.nickname ?? ''}` : `${platformName}账号`}
            className="size-11 rounded-full sm:size-9"
          >
            {/* The crown sits on this wrapper: the avatar itself clips its overflow */}
            <span className="relative flex">
              <Avatar>
                <ArtworkImage
                  cover={myStatus?.avatarUrl}
                  pending={verifying}
                  referrerPolicy="no-referrer"
                  fallback={<UserRound className="text-muted-foreground h-4 w-4" />}
                  className="size-full rounded-full"
                />
              </Avatar>
              {hasVip ? (
                <span
                  aria-hidden
                  className="ring-background absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full bg-amber-500 text-white ring-2"
                >
                  <Crown className="size-2.5" />
                </span>
              ) : null}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 space-y-3">
          <div className="flex items-center gap-3">
            <Avatar size="lg">
              <ArtworkImage
                cover={myStatus?.avatarUrl}
                pending={verifying}
                referrerPolicy="no-referrer"
                fallback={<UserRound className="text-muted-foreground h-5 w-5" />}
                className="size-full rounded-full"
              />
            </Avatar>
            <div className="min-w-0 flex-1 space-y-1">
              {loggedIn ? (
                <p className="truncate text-sm font-medium">{myStatus?.nickname ?? platformName}</p>
              ) : verifying ? (
                <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  验证登录中…
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">未登录{platformName}</p>
              )}
              {loggedIn ? <VipBadge platform={platform} vipType={myStatus?.vipType} /> : null}
            </div>
          </div>
          <p className="text-muted-foreground text-xs">{roomLine}</p>
          <Separator />
          {loggedIn ? (
            <Button
              variant="outline"
              className="text-destructive min-h-11 w-full gap-2 sm:min-h-9"
              onClick={() => {
                setOpen(false)
                logout()
              }}
            >
              <LogOut className="h-4 w-4" />
              登出
            </Button>
          ) : verifying ? null : (
            <LoginActions
              className="grid gap-2"
              onQrLogin={() => {
                setOpen(false)
                startQrLogin()
              }}
              onCookieLogin={() => {
                setOpen(false)
                setCookieOpen(true)
              }}
            />
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
