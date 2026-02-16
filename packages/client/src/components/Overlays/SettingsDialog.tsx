import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  KeyRound,
  Palette,
  Settings2,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { RoomSettingsSection } from './Settings/RoomSettingsSection'
import { MembersSection } from './Settings/MembersSection'
import { ProfileSettingsSection } from './Settings/ProfileSettingsSection'
import { AppearanceSection } from './Settings/AppearanceSection'
import { PlatformHub } from './Settings/PlatformHub'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SettingsTab = 'room' | 'members' | 'profile' | 'appearance' | 'accounts'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdateSettings: (settings: {
    name?: string
    password?: string | null
    audioQuality?: import('@music-together/shared').AudioQuality
  }) => void
  onSetUserRole?: (userId: string, role: 'admin' | 'member') => void
  initialTab?: SettingsTab
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
      role="tab"
      aria-selected={active}
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
// Tab config
// ---------------------------------------------------------------------------

const TABS: { id: SettingsTab; icon: LucideIcon; label: string }[] = [
  { id: 'room', icon: Settings2, label: '房间' },
  { id: 'members', icon: Users, label: '成员' },
  { id: 'accounts', icon: KeyRound, label: '账号' },
  { id: 'profile', icon: UserCog, label: '个人' },
  { id: 'appearance', icon: Palette, label: '外观' },
]

// ---------------------------------------------------------------------------
// Main Dialog
// ---------------------------------------------------------------------------

export function SettingsDialog({
  open,
  onOpenChange,
  onUpdateSettings,
  onSetUserRole,
  initialTab,
}: SettingsDialogProps) {
  const [tab, setTab] = useState<SettingsTab>('room')

  // When dialog opens with an initialTab, jump to it
  useEffect(() => {
    if (open && initialTab) {
      setTab(initialTab)
    }
  }, [open, initialTab])

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="gap-0 p-0 md:max-w-[75vw] lg:max-w-[60vw]">
        <ResponsiveDialogDescription className="sr-only">
          调整房间、歌词和其他设置
        </ResponsiveDialogDescription>
        <div className="flex h-[70vh] flex-col md:flex-row">
          {/* Mobile: top tab bar */}
          <div className="flex shrink-0 flex-col border-b md:hidden">
            <ResponsiveDialogTitle className="px-4 pt-4 pb-2 text-lg font-semibold">
              设置
            </ResponsiveDialogTitle>
            <nav className="scrollbar-hide flex gap-1 overflow-x-auto px-4 pb-2" role="tablist" aria-label="设置分类">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    tab === t.id
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                  )}
                >
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Desktop: left side nav */}
          <nav className="hidden w-48 shrink-0 flex-col border-r p-4 md:flex" role="tablist" aria-label="设置分类">
            <ResponsiveDialogTitle className="mb-4 px-3 text-lg font-semibold">
              设置
            </ResponsiveDialogTitle>
            <div className="space-y-1">
              {TABS.map((t) => (
                <NavItem
                  key={t.id}
                  icon={t.icon}
                  label={t.label}
                  active={tab === t.id}
                  onClick={() => setTab(t.id)}
                />
              ))}
            </div>
          </nav>

          {/* Content area — accounts tab uses its own scroll management for virtual list */}
          {tab === 'accounts' ? (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4 sm:p-6">
              <PlatformHub />
            </div>
          ) : (
            <ScrollArea className="min-h-0 flex-1">
              <div className="p-4 sm:p-6">
                {tab === 'room' && (
                  <RoomSettingsSection onUpdateSettings={onUpdateSettings} />
                )}
                {tab === 'members' && (
                  <MembersSection onSetUserRole={onSetUserRole} />
                )}
                {tab === 'profile' && <ProfileSettingsSection />}
                {tab === 'appearance' && <AppearanceSection />}
              </div>
            </ScrollArea>
          )}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
