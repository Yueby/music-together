// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { vipLabel } from '@/lib/platform'

vi.mock('@/hooks/useArtworkUrl', () => ({
  useArtworkUrl: (url?: string) => url,
  useArtwork: (url?: string) => ({ src: url, failed: false }),
}))

import { AccountMenu } from './AccountMenu'

const base = {
  platform: 'netease' as const,
  setPlatform: vi.fn(),
  roomStatus: { platform: 'netease' as const, loggedInCount: 2, hasVip: true, maxVipType: 11 },
  verifying: false,
  startQrLogin: vi.fn(),
  setCookieOpen: vi.fn(),
  logout: vi.fn(),
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  vi.clearAllMocks()
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

const openAvatar = () => act(() => container.querySelector<HTMLButtonElement>('button[aria-label*="账号"]')!.click())

describe('vipLabel', () => {
  it.each([
    ['netease', 0, ''],
    ['netease', 1, 'VIP'],
    ['netease', 11, '黑胶VIP'],
    ['tencent', 1, 'VIP'],
    ['tencent', 2, 'SVIP'],
    ['kugou', 2, '豪华VIP'],
    ['kugou', 3, '超级VIP'],
    ['kugou', undefined, ''],
  ] as const)('%s level %s is %j', (platform, level, label) => {
    expect(vipLabel(platform, level)).toBe(label)
  })
})

describe('AccountMenu', () => {
  it('shows the account and its membership as a badge when signed in', () => {
    act(() =>
      root.render(
        <AccountMenu
          {...base}
          myStatus={{
            platform: 'netease',
            loggedIn: true,
            nickname: '月白',
            vipType: 11,
            avatarUrl: 'https://p1.music.126.net/a.jpg',
          }}
        />,
      ),
    )
    openAvatar()
    const card = document.body.textContent ?? ''
    expect(card).toContain('月白')
    expect(document.body.querySelector('[data-testid="vip-badge"]')?.textContent).toBe('黑胶VIP')
    expect(card).toContain('房间内 2 人已登录，VIP 可用')
    expect(card).toContain('登出')
    expect(card).not.toContain('扫码登录')
  })

  it('offers both sign-in ways, and no badge, when signed out', () => {
    act(() => root.render(<AccountMenu {...base} myStatus={{ platform: 'netease', loggedIn: false }} />))
    openAvatar()
    expect(document.body.querySelector('[data-testid="vip-badge"]')).toBeNull()
    const buttons = [...document.body.querySelectorAll('button')].map((button) => button.textContent)
    expect(buttons).toContain('扫码登录')
    expect(buttons).toContain('Cookie 登录')
    act(() => [...document.body.querySelectorAll('button')].find((b) => b.textContent === '扫码登录')!.click())
    expect(base.startQrLogin).toHaveBeenCalledOnce()
  })

  it('does not offer to sign in while a saved login is being verified', () => {
    act(() => root.render(<AccountMenu {...base} verifying myStatus={undefined} />))
    openAvatar()
    expect(document.body.textContent).toContain('验证登录中')
    expect(document.body.textContent).not.toContain('扫码登录')
  })
})
