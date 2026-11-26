// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { storage } from '@/lib/storage'
import { UserPopover } from './UserPopover'

describe('UserPopover', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    localStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('provides an accessible aria-label and mobile touch target when no nickname is set', () => {
    act(() => {
      root.render(<UserPopover />)
    })

    const trigger = container.querySelector<HTMLButtonElement>('button')
    expect(trigger).not.toBeNull()
    expect(trigger?.getAttribute('aria-label')).toBe('个人设置')
    expect(trigger?.className).toContain('min-h-11')
    expect(trigger?.className).toContain('min-w-11')
  })

  it('includes the saved nickname in the trigger aria-label', () => {
    storage.setNickname('Mika')
    act(() => {
      root.render(<UserPopover />)
    })

    const trigger = container.querySelector<HTMLButtonElement>('button')
    expect(trigger?.getAttribute('aria-label')).toBe('个人设置（Mika）')
  })
})
