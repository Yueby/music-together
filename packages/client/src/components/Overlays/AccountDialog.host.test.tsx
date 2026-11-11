// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { HostRuntime } from '@/lib/hostRuntime'

const runtimeState: { -readonly [Key in keyof HostRuntime]: HostRuntime[Key] } = {
  kind: 'web',
  platformAccounts: true,
  nativeMediaSession: true,
  versionCheck: true,
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
  DIALOG_BAR_CLASS: '',
  DIALOG_BODY_CLASS: '',
  ResponsiveDialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
  ResponsiveDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResponsiveDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResponsiveDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  ResponsiveDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

vi.mock('@/hooks/useAccountSession', () => ({
  useAccountSession: () => ({
    auth: { qrPlatform: 'netease', qrData: null, qrStatus: null, isQrLoading: false },
    platform: 'netease',
    qrOpen: false,
    cookieOpen: false,
  }),
}))

vi.mock('./Settings/PlatformHub', () => ({
  PlatformHub: () => <div data-testid="platform-hub">PlatformHubContent</div>,
}))
vi.mock('./Settings/AccountMenu', () => ({
  AccountMenu: () => <div data-testid="account-menu">AccountMenuContent</div>,
}))
vi.mock('./Settings/QrLoginDialog', () => ({ QrLoginDialog: () => null }))
vi.mock('./Settings/ManualCookieDialog', () => ({ ManualCookieDialog: () => null }))

import { AccountDialog } from './AccountDialog'

describe('AccountDialog', () => {
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

  it('shows the account title and mounts PlatformHub when the host has platform accounts (Web)', () => {
    runtimeState.platformAccounts = true
    act(() => root.render(<AccountDialog open onOpenChange={vi.fn()} />))
    expect(container.querySelector('h2')?.textContent).toBe('音乐账号')
    expect(container.querySelector('[data-testid="platform-hub"]')).not.toBeNull()
    // Platform switcher and avatar live in the header, not in the body.
    expect(container.querySelector('[data-testid="account-menu"]')).not.toBeNull()
  })

  it('renders nothing for a host without platform accounts (Mapp)', () => {
    runtimeState.platformAccounts = false
    act(() => root.render(<AccountDialog open onOpenChange={vi.fn()} />))
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(container.querySelector('[data-testid="platform-hub"]')).toBeNull()
  })

  it('mounts nothing while closed', () => {
    runtimeState.platformAccounts = true
    act(() => root.render(<AccountDialog open={false} onOpenChange={vi.fn()} />))
    expect(container.querySelector('[data-testid="platform-hub"]')).toBeNull()
  })
})
