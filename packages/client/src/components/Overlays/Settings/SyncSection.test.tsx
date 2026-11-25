// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { storage } from '@/lib/storage'
import { usePlayerStore } from '@/stores/playerStore'
import { SyncSection } from './SyncSection'

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
  usePlayerStore.getState().setAudioLatencyOffsetMs(null)
  usePlayerStore.getState().setDetectedAudioLatencyMs(80)
  usePlayerStore.getState().setSyncDrift(-0.018)
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllGlobals()
})

it('switches to manual mode, persists slider changes, and resets to auto', () => {
  render(<TooltipProvider><SyncSection /></TooltipProvider>)
  const automatic = screen.getByRole('switch', { name: '自动检测设备延迟' })
  const slider = screen.getByRole('slider')
  expect(automatic.getAttribute('aria-checked')).toBe('true')
  expect(slider.getAttribute('aria-valuenow')).toBe('80')
  expect(screen.getByText('-18 ms')).toBeTruthy()

  fireEvent.click(automatic)
  expect(automatic.getAttribute('aria-checked')).toBe('false')
  expect(storage.getAudioLatencyOffsetMs()).toBe(80)
  slider.focus()
  fireEvent.keyDown(slider, { key: 'ArrowRight' })
  expect(slider.getAttribute('aria-valuenow')).toBe('90')
  expect(storage.getAudioLatencyOffsetMs()).toBe(90)

  fireEvent.click(screen.getByRole('button', { name: '恢复默认' }))
  expect(automatic.getAttribute('aria-checked')).toBe('true')
  expect(slider.getAttribute('aria-valuenow')).toBe('80')
  expect(storage.getAudioLatencyOffsetMs()).toBeNull()
})
