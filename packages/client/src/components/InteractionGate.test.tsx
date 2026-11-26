// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LazyMotion, domAnimation } from 'motion/react'
import { storage } from '@/lib/storage'
import { InteractionGate } from './InteractionGate'

describe('InteractionGate', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    localStorage.clear()
    storage.setNickname('Alice')
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

  it('disables submit, shows loading state, and prevents double-submit while async onStart is pending', async () => {
    let resolveStart!: () => void
    const onStart = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveStart = resolve
        }),
    )

    act(() => {
      root.render(
        <LazyMotion features={domAnimation}>
          <InteractionGate onStart={onStart} roomName="Lo-Fi" />
        </LazyMotion>,
      )
    })

    const form = container.querySelector('form')!
    const button = container.querySelector<HTMLButtonElement>('button[type="submit"]')!
    expect(button.disabled).toBe(false)
    expect(button.getAttribute('aria-label')).toBe('开始收听')

    act(() => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    expect(onStart).toHaveBeenCalledTimes(1)
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.textContent).toContain('正在进入')

    await act(async () => {
      resolveStart()
      await Promise.resolve()
    })

    expect(button.disabled).toBe(false)
    expect(button.getAttribute('aria-busy')).toBeNull()
    expect(button.textContent).toContain('开始收听')
  })

  it('recovers cleanly without unhandled rejection when async onStart rejects', async () => {
    const onStart = vi.fn(() => Promise.reject(new Error('unlock failed')))

    act(() => {
      root.render(
        <LazyMotion features={domAnimation}>
          <InteractionGate onStart={onStart} roomName="Lo-Fi" />
        </LazyMotion>,
      )
    })

    const form = container.querySelector('form')!
    const button = container.querySelector<HTMLButtonElement>('button[type="submit"]')!

    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await Promise.resolve()
    })

    expect(onStart).toHaveBeenCalledTimes(1)
    expect(button.disabled).toBe(false)
    expect(button.getAttribute('aria-busy')).toBeNull()
  })
})
