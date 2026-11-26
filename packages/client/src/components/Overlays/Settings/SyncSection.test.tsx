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

it('renders sync status and compensation rows following SettingRow conventions', () => {
  const { container } = render(<TooltipProvider><SyncSection /></TooltipProvider>)
  const labels = Array.from(container.querySelectorAll('label')).map((l) => l.textContent)
  const hints = Array.from(container.querySelectorAll('label + p')).map((p) => p.textContent)

  expect(labels).toEqual(['同步偏移', '设备检测延迟', '自动检测设备延迟', '延迟补偿'])
  expect(hints).toHaveLength(labels.length)
  expect(hints[2]).toContain('网页端无法探测')
  expect(container.querySelector('dl')).toBeNull()
  expect(screen.getByText('-18 ms').className).toContain('text-muted-foreground')
  expect(screen.getByText('80 ms')).toBeTruthy()
})

it('highlights noticeable sync drift above 100 ms with warning color', () => {
  usePlayerStore.getState().setSyncDrift(0.15)
  render(<TooltipProvider><SyncSection /></TooltipProvider>)
  const driftValue = screen.getByText('+150 ms')
  expect(driftValue.className).toContain('text-yellow-500')
})

it('switches to manual mode, edits via slider and numeric input, clamps bounds, and resets to auto', () => {
  render(<TooltipProvider><SyncSection /></TooltipProvider>)
  const automatic = screen.getByRole('switch', { name: '自动检测设备延迟' })
  const slider = screen.getByRole('slider')
  const input = screen.getByRole('spinbutton', { name: '延迟补偿（毫秒）' }) as HTMLInputElement

  expect(automatic.getAttribute('aria-checked')).toBe('true')
  expect(slider.getAttribute('aria-valuenow')).toBe('80')
  expect(input.value).toBe('80')
  expect(input.disabled).toBe(true)
  expect(screen.getByText('-18 ms')).toBeTruthy()

  fireEvent.click(automatic)
  expect(automatic.getAttribute('aria-checked')).toBe('false')
  expect(input.disabled).toBe(false)
  expect(storage.getAudioLatencyOffsetMs()).toBe(80)

  slider.focus()
  fireEvent.keyDown(slider, { key: 'ArrowRight' })
  expect(slider.getAttribute('aria-valuenow')).toBe('90')
  expect(input.value).toBe('90')
  expect(storage.getAudioLatencyOffsetMs()).toBe(90)

  // Direct numeric input supports 1ms precision and negative offsets
  fireEvent.change(input, { target: { value: '125' } })
  expect(storage.getAudioLatencyOffsetMs()).toBe(90) // not committed until blur/Enter
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(storage.getAudioLatencyOffsetMs()).toBe(125)
  expect(slider.getAttribute('aria-valuenow')).toBe('125')

  fireEvent.change(input, { target: { value: '-150' } })
  fireEvent.blur(input)
  expect(storage.getAudioLatencyOffsetMs()).toBe(-150)
  expect(slider.getAttribute('aria-valuenow')).toBe('-150')

  // Clamps out-of-range values
  fireEvent.change(input, { target: { value: '999' } })
  fireEvent.blur(input)
  expect(storage.getAudioLatencyOffsetMs()).toBe(500)
  expect(input.value).toBe('500')

  // Invalid or empty input reverts to current committed value
  fireEvent.change(input, { target: { value: '' } })
  fireEvent.blur(input)
  expect(storage.getAudioLatencyOffsetMs()).toBe(500)
  expect(input.value).toBe('500')

  // Escape cancels unsaved edits
  fireEvent.change(input, { target: { value: '-200' } })
  fireEvent.keyDown(input, { key: 'Escape' })
  expect(storage.getAudioLatencyOffsetMs()).toBe(500)
  expect(input.value).toBe('500')

  fireEvent.click(screen.getByRole('button', { name: '恢复默认' }))
  expect(automatic.getAttribute('aria-checked')).toBe('true')
  expect(slider.getAttribute('aria-valuenow')).toBe('80')
  expect(input.value).toBe('80')
  expect(input.disabled).toBe(true)
  expect(storage.getAudioLatencyOffsetMs()).toBeNull()
})

it('previews slider drag in input without committing until pointer release', () => {
  usePlayerStore.getState().setAudioLatencyOffsetMs(0)
  const { container } = render(<TooltipProvider><SyncSection /></TooltipProvider>)
  const sliderRoot = container.querySelector('[data-slot="slider"]') as HTMLElement
  const slider = screen.getByRole('slider')
  const input = screen.getByRole('spinbutton', { name: '延迟补偿（毫秒）' }) as HTMLInputElement

  sliderRoot.setPointerCapture = vi.fn()
  sliderRoot.hasPointerCapture = vi.fn(() => true)
  sliderRoot.releasePointerCapture = vi.fn()
  vi.spyOn(sliderRoot, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    right: 800,
    bottom: 32,
    width: 800,
    height: 32,
    x: 0,
    y: 0,
    toJSON: () => {},
  })

  // x = 500 on a 800px track spanning [-300, 500] corresponds to +200 ms
  fireEvent.pointerDown(sliderRoot, { button: 0, pointerId: 1, clientX: 500 })
  expect(slider.getAttribute('aria-valuenow')).toBe('200')
  expect(input.value).toBe('200')
  expect(usePlayerStore.getState().audioLatencyOffsetMs).toBe(0)

  fireEvent.pointerUp(sliderRoot, { button: 0, pointerId: 1, clientX: 500 })
  expect(usePlayerStore.getState().audioLatencyOffsetMs).toBe(200)
  expect(storage.getAudioLatencyOffsetMs()).toBe(200)
})
