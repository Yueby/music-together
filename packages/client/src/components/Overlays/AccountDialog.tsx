import { DialogNavBar } from '@/components/DialogNav'
import { DIALOG_BODY_CLASS, ResponsiveDialog, ResponsiveDialogContent } from '@/components/ui/responsive-dialog'
import { useAccountSession } from '@/hooks/useAccountSession'
import { useDialogPages } from '@/hooks/useDialogPages'
import { hostRuntime } from '@/lib/hostRuntime'
import { cn } from '@/lib/utils'
import { AccountMenu } from './Settings/AccountMenu'
import { ManualCookieDialog } from './Settings/ManualCookieDialog'
import { PlatformHub, type AccountPage } from './Settings/PlatformHub'
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
  // A playlist, album or today's songs opened from the home page: one level in, named in the title bar
  const pages = useDialogPages<AccountPage>()

  return (
    <>
      {/* The platform switcher and the avatar sit top-right, left of the close button */}
      <DialogNavBar
        title={pages.current?.title ?? '音乐账号'}
        description="管理音乐平台账号和歌单"
        onBack={pages.current ? pages.back : undefined}
      >
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
      </DialogNavBar>
      {/* The lists virtualize their own scrolling, so this area must not scroll itself. */}
      <div className={cn(DIALOG_BODY_CLASS, 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden')}>
        <PlatformHub session={session} pages={pages} />
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
