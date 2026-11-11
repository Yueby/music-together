import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { Palette, Settings2, Type, Users, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { RoomSettingsSection } from './Settings/RoomSettingsSection'
import { MembersSection } from './Settings/MembersSection'
import { AppearanceSection } from './Settings/AppearanceSection'
import { LyricsSection } from './Settings/LyricsSection'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Music accounts live in their own dialog (`AccountDialog`), not here. */
export type SettingsTab = 'room' | 'members' | 'appearance' | 'lyrics'

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
// Tab config
// ---------------------------------------------------------------------------

const TABS: { id: SettingsTab; icon: LucideIcon; label: string }[] = [
  { id: 'room', icon: Settings2, label: '房间' },
  { id: 'members', icon: Users, label: '成员' },
  { id: 'appearance', icon: Palette, label: '外观' },
  { id: 'lyrics', icon: Type, label: '歌词' },
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
  const [tab, setTab] = useState<SettingsTab>(initialTab ?? 'room')
  // Wide: the categories are a column on the left; narrow: a row under the title.
  const wide = useMediaQuery('(min-width: 768px)')

  // When dialog opens with an initialTab, jump to it
  useEffect(() => {
    if (open && initialTab) setTab(initialTab)
  }, [open, initialTab])

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="gap-0 p-0 md:max-w-[75vw] lg:max-w-[60vw]">
        <ResponsiveDialogDescription className="sr-only">调整房间、歌词和其他设置</ResponsiveDialogDescription>
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as SettingsTab)}
          orientation={wide ? 'vertical' : 'horizontal'}
          className="h-[70vh] gap-0"
        >
          <div className="flex shrink-0 flex-col border-b md:w-48 md:border-r md:border-b-0 md:p-4">
            <ResponsiveDialogTitle className="px-4 pt-4 pb-2 text-lg font-semibold md:mb-4 md:px-3 md:pt-0">
              设置
            </ResponsiveDialogTitle>
            {/* A row under the title on narrow screens, a column on the left on wide ones */}
            <TabsList
              variant="nav"
              aria-label="设置分类"
              className="scrollbar-hide mx-4 mb-2 w-auto justify-start overflow-x-auto md:mx-0 md:mb-0 md:w-full md:overflow-visible"
            >
              {TABS.map(({ id, icon: Icon, label }) => (
                <TabsTrigger key={id} value={id}>
                  <Icon />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="p-4 sm:p-6">
              <TabsContent value="room">
                <RoomSettingsSection onUpdateSettings={onUpdateSettings} />
              </TabsContent>
              <TabsContent value="members">
                <MembersSection onSetUserRole={onSetUserRole} />
              </TabsContent>
              <TabsContent value="appearance">
                <AppearanceSection />
              </TabsContent>
              <TabsContent value="lyrics">
                <LyricsSection />
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
