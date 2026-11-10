// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { HostRuntime } from '@/lib/hostRuntime'

const runtimeState: { -readonly [Key in keyof HostRuntime]: HostRuntime[Key] } = {
  kind: 'web',
  platformAccounts: true,
  collections: true,
  nativeMediaSession: true,
  versionCheck: true,
  remoteArtwork: true,
  pixiBackground: true,
  clipboard: true,
  externalLinks: true,
}

vi.mock('@/lib/hostRuntime', () => ({
  hostRuntime: new Proxy({} as HostRuntime, {
    get: (_target, prop: keyof HostRuntime) => runtimeState[prop],
  }),
}))

vi.mock('@/components/ui/responsive-dialog', () => ({
  ResponsiveDialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
  ResponsiveDialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  ResponsiveDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResponsiveDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

vi.mock('./Settings/PlatformHub', () => ({
  PlatformHub: () => <div data-testid="platform-hub">PlatformHubContent</div>,
}))

vi.mock('./Settings/RoomSettingsSection', () => ({
  RoomSettingsSection: () => <div data-testid="room-settings">RoomSettingsContent</div>,
}))

vi.mock('./Settings/MembersSection', () => ({
  MembersSection: () => <div data-testid="members-section">Members</div>,
}))

vi.mock('./Settings/AppearanceSection', () => ({
  AppearanceSection: () => <div data-testid="appearance-section">Appearance</div>,
}))

vi.mock('./Settings/LyricsSection', () => ({
  LyricsSection: () => <div data-testid="lyrics-section">Lyrics</div>,
}))

import { SettingsDialog } from './SettingsDialog'

describe('SettingsDialog hostRuntime platformAccounts isolation', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
    vi.unstubAllGlobals()
  })

  it.each([true, false])(
    'never shows an accounts tab or the platform hub, whatever the host says (platformAccounts=%s)',
    (platformAccounts) => {
      runtimeState.platformAccounts = platformAccounts

      act(() => {
        root.render(<SettingsDialog open={true} onOpenChange={vi.fn()} onUpdateSettings={vi.fn()} />)
      })

      const tabTexts = Array.from(container.querySelectorAll('button[role="tab"]')).map((t) => t.textContent ?? '')
      expect(tabTexts.some((text) => text.includes('账号'))).toBe(false)
      expect(container.querySelector('[data-testid="platform-hub"]')).toBeNull()
      // The room tab is the default, and the remaining tabs are still there.
      expect(container.querySelector('[data-testid="room-settings"]')).not.toBeNull()
      expect(tabTexts.join('|')).toMatch(/房间.*成员.*外观.*歌词/)
    },
  )
})
