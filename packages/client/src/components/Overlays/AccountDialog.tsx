import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
import { useAccountSession } from '@/hooks/useAccountSession'
import { hostRuntime } from '@/lib/hostRuntime'
import { AccountMenu } from './Settings/AccountMenu'
import { ManualCookieDialog } from './Settings/ManualCookieDialog'
import { PlatformHub } from './Settings/PlatformHub'
import { QrLoginDialog } from './Settings/QrLoginDialog'

interface AccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Music accounts (NetEase / QQ Music / Kugou login, VIP status, own playlists, recommendations), kept apart from room
 * and display settings: it is about the person, not the room. Hosts without platform accounts never mount it.
 */
export function AccountDialog({ open, onOpenChange }: AccountDialogProps) {
  if (!hostRuntime.platformAccounts) return null
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="flex h-[70vh] flex-col gap-0 overflow-hidden p-0 md:max-w-[75vw] lg:max-w-[60vw]">
        <AccountDialogBody />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}

/** Inside the dialog content, so it (and the login state it wires up) exists only while the dialog is open. */
function AccountDialogBody() {
  const session = useAccountSession()
  const { auth } = session

  return (
    <>
      {/* The platform switcher and the avatar sit top-right, left of the close button */}
      <ResponsiveDialogHeader className="shrink-0 border-b px-4 py-3 pr-14 sm:px-6 sm:pr-14">
        <div className="flex items-center justify-between gap-3">
          <ResponsiveDialogTitle className="text-lg font-semibold">音乐账号</ResponsiveDialogTitle>
          <AccountMenu
            platform={session.platform}
            setPlatform={session.setPlatform}
            myStatus={session.myStatus}
            roomStatus={session.roomStatus}
            verifying={session.verifying}
            startQrLogin={session.startQrLogin}
            setCookieOpen={session.setCookieOpen}
            logout={session.logout}
          />
        </div>
        <ResponsiveDialogDescription className="sr-only sm:not-sr-only">
          登录音乐平台账号，用于 VIP 歌曲播放和导入自己的歌单
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>
      {/* The lists virtualize their own scrolling, so this area must not scroll itself. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4 sm:p-6">
        <PlatformHub session={session} />
      </div>

      <QrLoginDialog
        open={session.qrOpen}
        onOpenChange={session.changeQrOpen}
        platform={auth.qrPlatform}
        qrData={auth.qrData}
        qrStatus={auth.qrStatus}
        isLoading={auth.isQrLoading}
        onRefresh={() => auth.requestQrCode(auth.qrPlatform)}
        onCheckStatus={(key: string) => auth.checkQrStatus(key)}
      />
      <ManualCookieDialog
        open={session.cookieOpen}
        onOpenChange={session.setCookieOpen}
        platform={session.platform}
        onSubmit={session.submitCookie}
      />
    </>
  )
}
