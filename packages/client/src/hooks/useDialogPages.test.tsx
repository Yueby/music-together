// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDialogPages } from './useDialogPages'

let latest: ReturnType<typeof useDialogPages<{ title: string }>>
let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

function Probe() {
  const value = useDialogPages<{ title: string }>()
  useEffect(() => {
    latest = value
  })
  return null
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  root = createRoot(container)
  act(() => root.render(<Probe />))
})
afterEach(() => {
  act(() => root.unmount())
  vi.unstubAllGlobals()
})

describe('useDialogPages', () => {
  it("starts on the dialog's own page", () => {
    expect(latest.current).toBeNull()
    expect(latest.depth).toBe(0)
  })

  it('goes one level in and back out', () => {
    act(() => latest.open({ title: 'Album' }))
    expect(latest.current).toEqual({ title: 'Album' })
    expect(latest.depth).toBe(1)
    act(() => latest.back())
    expect(latest.current).toBeNull()
  })

  it('keeps a stack: back returns to the page it came from', () => {
    act(() => latest.open({ title: 'A' }))
    act(() => latest.open({ title: 'B' }))
    expect(latest.current?.title).toBe('B')
    act(() => latest.back())
    expect(latest.current?.title).toBe('A')
  })

  it('does nothing when there is nowhere to go back to, and resets to the first page from any depth', () => {
    act(() => latest.back())
    expect(latest.depth).toBe(0)
    act(() => latest.open({ title: 'A' }))
    act(() => latest.open({ title: 'B' }))
    act(() => latest.reset())
    expect(latest.current).toBeNull()
  })

  it('hands out functions that stay the same, so effects that depend on them do not rerun', () => {
    const { open, back, reset } = latest
    act(() => latest.open({ title: 'A' }))
    expect([latest.open, latest.back, latest.reset]).toEqual([open, back, reset])
  })
})
