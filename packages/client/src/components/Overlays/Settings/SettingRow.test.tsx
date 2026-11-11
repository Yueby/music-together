// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'
import { SettingRow } from './SettingRow'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

function render(props: { description?: string; value?: string }) {
  act(() =>
    root.render(
      <TooltipProvider>
        <SettingRow label="帧率" {...props}>
          <span>control</span>
        </SettingRow>
      </TooltipProvider>,
    ),
  )
}

describe('SettingRow', () => {
  it('keeps the description out of the layout and behind a hint button', () => {
    render({ description: '更高帧率更流畅' })
    expect(container.textContent).not.toContain('更高帧率更流畅')
    const hint = container.querySelector('button[aria-label="更高帧率更流畅"]')
    expect(hint).not.toBeNull()
  })

  it('shows the description in a tooltip when the hint gets focus', () => {
    render({ description: '更高帧率更流畅' })
    const hint = container.querySelector<HTMLButtonElement>('button[aria-label="更高帧率更流畅"]')!
    act(() => hint.focus())
    expect(document.body.textContent).toContain('更高帧率更流畅')
  })

  it('shows the description on tap too, as touch screens have no hover', () => {
    render({ description: '更高帧率更流畅' })
    const hint = container.querySelector<HTMLButtonElement>('button[aria-label="更高帧率更流畅"]')!
    act(() => {
      hint.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }))
      hint.click()
    })
    expect(document.body.textContent).toContain('更高帧率更流畅')
  })

  it('has no hint button without a description', () => {
    render({})
    expect(container.querySelector('button')).toBeNull()
  })

  it('shows a live value beside the control', () => {
    render({ value: '60%' })
    expect(container.textContent).toContain('60%')
  })
})
