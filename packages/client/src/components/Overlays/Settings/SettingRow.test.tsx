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
  it('shows the description under the label', () => {
    render({ description: '更高帧率更流畅' })
    const description = Array.from(container.querySelectorAll('p')).find((p) => p.textContent === '更高帧率更流畅')
    expect(description).toBeDefined()
    expect(description?.previousElementSibling?.textContent).toBe('帧率')
  })

  it('has no description line without one', () => {
    render({})
    expect(container.querySelector('p')).toBeNull()
  })

  it('shows a live value beside the control', () => {
    render({ value: '60%' })
    expect(container.textContent).toContain('60%')
  })
})
