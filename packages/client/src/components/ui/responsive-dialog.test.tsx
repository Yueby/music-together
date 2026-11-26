// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const layoutState = vi.hoisted(() => ({ isMobile: true }))

vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => layoutState.isMobile }))

vi.mock('@/components/ui/drawer', () => ({
  Drawer: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div data-testid="drawer-root">{children}</div> : null),
  DrawerContent: ({ className, children }: { className?: string; children: ReactNode }) => (
    <div data-testid="drawer-content" className={className}>
      {children}
    </div>
  ),
  DrawerHeader: ({ className, children }: { className?: string; children: ReactNode }) => (
    <div data-testid="drawer-header" className={className}>
      {children}
    </div>
  ),
  DrawerTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DrawerDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DrawerFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerClose: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ className, children }: { className?: string; children: ReactNode }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ className, children }: { className?: string; children: ReactNode }) => (
    <div data-testid="dialog-header" className={className}>
      {children}
    </div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogClose: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

import {
  DIALOG_BAR_CLASS,
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from './responsive-dialog'

describe('ResponsiveDialog', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    layoutState.isMobile = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  it('centers portrait drawer content and strips desktop close-button right padding on mobile headers', () => {
    layoutState.isMobile = true

    act(() => {
      root.render(
        <ResponsiveDialog open onOpenChange={vi.fn()}>
          <ResponsiveDialogContent className="gap-0 p-0 md:max-w-[75vw]">
            <ResponsiveDialogHeader className={DIALOG_BAR_CLASS}>
              <ResponsiveDialogTitle>设置</ResponsiveDialogTitle>
            </ResponsiveDialogHeader>
          </ResponsiveDialogContent>
        </ResponsiveDialog>,
      )
    })

    const content = container.querySelector('[data-testid="drawer-content"]')
    expect(content?.className).toContain('mx-auto')
    expect(content?.className).toContain('w-full')

    const header = container.querySelector('[data-testid="drawer-header"]')
    expect(header?.className).not.toContain('pr-14')
    expect(header?.className).toContain('pr-4')
    expect(header?.className).toContain('sm:pr-6')
  })

  it('preserves pr-14 room for the close button on desktop dialogs', () => {
    layoutState.isMobile = false

    act(() => {
      root.render(
        <ResponsiveDialog open onOpenChange={vi.fn()}>
          <ResponsiveDialogContent className="gap-0 p-0 md:max-w-[75vw]">
            <ResponsiveDialogHeader className={DIALOG_BAR_CLASS}>
              <ResponsiveDialogTitle>设置</ResponsiveDialogTitle>
            </ResponsiveDialogHeader>
          </ResponsiveDialogContent>
        </ResponsiveDialog>,
      )
    })

    const header = container.querySelector('[data-testid="dialog-header"]')
    expect(header?.className).toContain('pr-14')
  })
})
