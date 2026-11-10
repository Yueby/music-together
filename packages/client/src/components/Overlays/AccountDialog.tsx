import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
import { hostRuntime } from '@/lib/hostRuntime'
import { PlatformHub } from './Settings/PlatformHub'

interface AccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Music accounts (NetEase / QQ Music / Kugou login, VIP status, own playlists), kept apart from room and display
 * settings: it is about the person, not the room. Hosts without platform accounts never mount it.
 */
export function AccountDialog({ open, onOpenChange }: AccountDialogProps) {
  if (!hostRuntime.platformAccounts) return null
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="flex h-[70vh] flex-col gap-0 overflow-hidden p-0 md:max-w-[75vw] lg:max-w-[60vw]">
        <ResponsiveDialogHeader className="shrink-0 border-b px-4 py-3 pr-12 sm:px-6">
          <ResponsiveDialogTitle className="text-lg font-semibold">音乐账号</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>登录音乐平台账号，用于 VIP 歌曲播放和导入自己的歌单</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        {/* The playlist list virtualizes its own scrolling, so this area must not scroll itself. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4 sm:p-6">
          <PlatformHub />
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
