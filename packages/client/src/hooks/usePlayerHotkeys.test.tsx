// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Track } from '@music-together/shared'
import { usePlayerStore } from '@/stores/playerStore'
import { usePlayerHotkeys, type UsePlayerHotkeysOptions } from './usePlayerHotkeys'

const SAMPLE_TRACK: Track = {
  id: 'track-1',
  title: 'Night Drive',
  artist: ['Synthwave'],
  album: 'Midnight',
  cover: '',
  duration: 240,
  source: 'netease',
  sourceId: 'track-1',
  urlId: 'track-1',
}

function dispatchKey(
  target: EventTarget,
  init: KeyboardEventInit & { key: string; code: string },
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  })
  target.dispatchEvent(event)
  return event
}

describe('usePlayerHotkeys', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  let handlers: Pick<UsePlayerHotkeysOptions, 'onPlay' | 'onPause' | 'onNext' | 'onPrev' | 'onOpenSearch'>

  const mount = (overrides: Partial<UsePlayerHotkeysOptions> = {}) => {
    const props: UsePlayerHotkeysOptions = {
      enabled: true,
      canPlay: true,
      anyDialogOpen: false,
      ...handlers,
      ...overrides,
    }
    function Harness() {
      usePlayerHotkeys(props)
      return null
    }
    act(() => root.render(<Harness />))
  }

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    usePlayerStore.getState().reset()
    usePlayerStore.getState().setVolume(0.75)

    handlers = {
      onPlay: vi.fn(),
      onPause: vi.fn(),
      onNext: vi.fn(),
      onPrev: vi.fn(),
      onOpenSearch: vi.fn(),
    }

    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    document.body.innerHTML = ''
    usePlayerStore.getState().reset()
    vi.unstubAllGlobals()
  })

  it('toggles play/pause on Space when canPlay is true and a track is loaded', () => {
    usePlayerStore.getState().setCurrentTrack(SAMPLE_TRACK)
    usePlayerStore.getState().setIsPlaying(false)
    mount({ canPlay: true })

    const playEvent = dispatchKey(window, { key: ' ', code: 'Space' })
    expect(playEvent.defaultPrevented).toBe(true)
    expect(handlers.onPlay).toHaveBeenCalledOnce()
    expect(handlers.onPause).not.toHaveBeenCalled()

    usePlayerStore.getState().setIsPlaying(true)
    const pauseEvent = dispatchKey(window, { key: ' ', code: 'Space' })
    expect(pauseEvent.defaultPrevented).toBe(true)
    expect(handlers.onPause).toHaveBeenCalledOnce()
  })

  it('ignores Space when canPlay is false or no track is loaded', () => {
    usePlayerStore.getState().setCurrentTrack(SAMPLE_TRACK)
    mount({ canPlay: false })
    const deniedEvent = dispatchKey(window, { key: ' ', code: 'Space' })
    expect(deniedEvent.defaultPrevented).toBe(false)
    expect(handlers.onPlay).not.toHaveBeenCalled()
    expect(handlers.onPause).not.toHaveBeenCalled()

    usePlayerStore.getState().setCurrentTrack(null)
    mount({ canPlay: true })
    const noTrackEvent = dispatchKey(window, { key: ' ', code: 'Space' })
    expect(noTrackEvent.defaultPrevented).toBe(false)
    expect(handlers.onPlay).not.toHaveBeenCalled()
  })

  it('toggles local mute/unmute on KeyM even when canPlay is false', () => {
    usePlayerStore.getState().setVolume(0.6)
    mount({ canPlay: false })

    dispatchKey(window, { key: 'm', code: 'KeyM' })
    expect(usePlayerStore.getState().volume).toBe(0)

    dispatchKey(window, { key: 'm', code: 'KeyM' })
    expect(usePlayerStore.getState().volume).toBe(0.6)
  })

  it('triggers onNext and onPrev on Shift+ArrowRight and Shift+ArrowLeft when canPlay and hasTrack', () => {
    usePlayerStore.getState().setCurrentTrack(SAMPLE_TRACK)
    mount({ canPlay: true })

    dispatchKey(window, { key: 'ArrowRight', code: 'ArrowRight', shiftKey: true })
    expect(handlers.onNext).toHaveBeenCalledOnce()

    dispatchKey(window, { key: 'ArrowLeft', code: 'ArrowLeft', shiftKey: true })
    expect(handlers.onPrev).toHaveBeenCalledOnce()

    mount({ canPlay: false })
    dispatchKey(window, { key: 'ArrowRight', code: 'ArrowRight', shiftKey: true })
    dispatchKey(window, { key: 'ArrowLeft', code: 'ArrowLeft', shiftKey: true })
    expect(handlers.onNext).toHaveBeenCalledOnce()
    expect(handlers.onPrev).toHaveBeenCalledOnce()
  })

  it('opens search on "/", Meta+k, and Control+k with preventDefault', () => {
    mount()

    const slashEvent = dispatchKey(window, { key: '/', code: 'Slash' })
    expect(slashEvent.defaultPrevented).toBe(true)

    const metaKEvent = dispatchKey(window, { key: 'k', code: 'KeyK', metaKey: true })
    expect(metaKEvent.defaultPrevented).toBe(true)

    const ctrlKEvent = dispatchKey(window, { key: 'k', code: 'KeyK', ctrlKey: true })
    expect(ctrlKEvent.defaultPrevented).toBe(true)

    expect(handlers.onOpenSearch).toHaveBeenCalledTimes(3)
  })

  it('ignores all shortcuts when typing inside input, textarea, select, contenteditable, or during IME composition', () => {
    usePlayerStore.getState().setCurrentTrack(SAMPLE_TRACK)
    mount({ canPlay: true })

    const input = document.createElement('input')
    const textarea = document.createElement('textarea')
    const select = document.createElement('select')
    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    const editableChild = document.createElement('span')
    editable.appendChild(editableChild)
    document.body.append(input, textarea, select, editable)

    for (const el of [input, textarea, select, editable, editableChild]) {
      dispatchKey(el, { key: ' ', code: 'Space' })
      dispatchKey(el, { key: 'm', code: 'KeyM' })
      dispatchKey(el, { key: '/', code: 'Slash' })
      dispatchKey(el, { key: 'k', code: 'KeyK', ctrlKey: true })
      dispatchKey(el, { key: 'k', code: 'KeyK', metaKey: true })
      dispatchKey(el, { key: 'ArrowRight', code: 'ArrowRight', shiftKey: true })
    }

    dispatchKey(window, { key: ' ', code: 'Space', isComposing: true })
    dispatchKey(window, { key: 'm', code: 'KeyM', isComposing: true })
    dispatchKey(window, { key: 'k', code: 'KeyK', ctrlKey: true, isComposing: true })

    expect(handlers.onPlay).not.toHaveBeenCalled()
    expect(handlers.onNext).not.toHaveBeenCalled()
    expect(handlers.onOpenSearch).not.toHaveBeenCalled()
    expect(usePlayerStore.getState().volume).toBe(0.75)
  })

  it('ignores Space when focus is on an interactive control like a button or slider', () => {
    usePlayerStore.getState().setCurrentTrack(SAMPLE_TRACK)
    mount({ canPlay: true })

    const button = document.createElement('button')
    const slider = document.createElement('div')
    slider.setAttribute('role', 'slider')
    document.body.append(button, slider)

    const btnEvent = dispatchKey(button, { key: ' ', code: 'Space' })
    const sliderEvent = dispatchKey(slider, { key: ' ', code: 'Space' })

    expect(btnEvent.defaultPrevented).toBe(false)
    expect(sliderEvent.defaultPrevented).toBe(false)
    expect(handlers.onPlay).not.toHaveBeenCalled()
  })

  it('ignores single-key shortcuts when anyDialogOpen is true or a [role="dialog"] element is in the DOM', () => {
    usePlayerStore.getState().setCurrentTrack(SAMPLE_TRACK)
    mount({ canPlay: true, anyDialogOpen: true })

    dispatchKey(window, { key: ' ', code: 'Space' })
    dispatchKey(window, { key: 'm', code: 'KeyM' })
    dispatchKey(window, { key: '/', code: 'Slash' })
    dispatchKey(window, { key: 'ArrowRight', code: 'ArrowRight', shiftKey: true })
    dispatchKey(window, { key: 'ArrowLeft', code: 'ArrowLeft', shiftKey: true })

    expect(handlers.onPlay).not.toHaveBeenCalled()
    expect(handlers.onNext).not.toHaveBeenCalled()
    expect(handlers.onPrev).not.toHaveBeenCalled()
    expect(handlers.onOpenSearch).not.toHaveBeenCalled()
    expect(usePlayerStore.getState().volume).toBe(0.75)

    // Also verified via DOM [role="dialog"] fallback when anyDialogOpen prop is false
    mount({ canPlay: true, anyDialogOpen: false })
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.appendChild(dialog)

    dispatchKey(window, { key: ' ', code: 'Space' })
    dispatchKey(window, { key: 'm', code: 'KeyM' })
    dispatchKey(window, { key: '/', code: 'Slash' })

    expect(handlers.onPlay).not.toHaveBeenCalled()
    expect(handlers.onOpenSearch).not.toHaveBeenCalled()
    expect(usePlayerStore.getState().volume).toBe(0.75)
  })

  it('does not bind shortcuts when enabled is false', () => {
    usePlayerStore.getState().setCurrentTrack(SAMPLE_TRACK)
    mount({ enabled: false, canPlay: true })

    dispatchKey(window, { key: ' ', code: 'Space' })
    dispatchKey(window, { key: 'm', code: 'KeyM' })
    dispatchKey(window, { key: '/', code: 'Slash' })

    expect(handlers.onPlay).not.toHaveBeenCalled()
    expect(handlers.onOpenSearch).not.toHaveBeenCalled()
    expect(usePlayerStore.getState().volume).toBe(0.75)
  })
})
