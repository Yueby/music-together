// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/components/ui/responsive-dialog', () => ({
  DIALOG_BAR_CLASS: '',
  ResponsiveDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResponsiveDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  ResponsiveDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

import { DialogNavBar } from './DialogNav'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

const backButton = () => container.querySelector('button[aria-label="返回"]')

describe('DialogNavBar', () => {
  it('shows the title, the description for screen readers and the controls, with no back button on the first page', () => {
    act(() =>
      root.render(
        <DialogNavBar title="音乐账号" description="管理账号">
          <span data-testid="controls" />
        </DialogNavBar>,
      ),
    )
    expect(container.querySelector('h2')?.textContent).toBe('音乐账号')
    expect(container.querySelector('p')?.textContent).toBe('管理账号')
    expect(container.querySelector('[data-testid="controls"]')).not.toBeNull()
    expect(backButton()).toBeNull()
  })

  it('has a back button once a page was entered, and it goes back', () => {
    const onBack = vi.fn()
    act(() => root.render(<DialogNavBar title="热歌榜" description="d" onBack={onBack} />))
    expect(container.querySelector('h2')?.textContent).toBe('热歌榜')
    act(() => (backButton() as HTMLButtonElement).click())
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('shows the title of the page it moved to', () => {
    act(() => root.render(<DialogNavBar title="A" description="d" />))
    act(() => root.render(<DialogNavBar title="B" description="d" onBack={() => {}} />))
    expect(container.querySelectorAll('h2')).toHaveLength(1)
    expect(container.querySelector('h2')?.textContent).toBe('B')
  })
})
