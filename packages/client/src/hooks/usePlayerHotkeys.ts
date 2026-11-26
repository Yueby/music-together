import { useEffect, useRef } from 'react'
import { usePlayerStore } from '@/stores/playerStore'

const EDITABLE_SELECTOR =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]'

const INTERACTIVE_SPACE_SELECTOR =
  'button, a[href], [role="button"], [role="slider"], [role="switch"], [role="menuitem"], [role="tab"]'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (target instanceof HTMLElement && target.isContentEditable) return true
  return target.closest(EDITABLE_SELECTOR) !== null
}

function isInteractiveControlTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return target.closest(INTERACTIVE_SPACE_SELECTOR) !== null
}

function isAnyDialogOpen(anyDialogOpen?: boolean): boolean {
  return Boolean(anyDialogOpen) || document.querySelector('[role="dialog"]') !== null
}

export interface UsePlayerHotkeysOptions {
  enabled: boolean
  canPlay: boolean
  anyDialogOpen?: boolean
  onPlay: () => void
  onPause: () => void
  onNext: () => void
  onPrev: () => void
  onOpenSearch: () => void
}

/**
 * Global desktop player keyboard shortcuts scoped to the room view.
 *
 * - `Space`: toggle play/pause (requires `canPlay` and a loaded track; yields to focused buttons/controls)
 * - `M`: toggle local mute/unmute (available to all room members)
 * - `Shift+ArrowRight` / `Shift+ArrowLeft`: next / previous track (requires `canPlay` and a loaded track)
 * - `/` and `Cmd+K` / `Ctrl+K`: open music search
 */
export function usePlayerHotkeys(options: UsePlayerHotkeysOptions) {
  const optionsRef = useRef(options)
  optionsRef.current = options

  // Mirrors SongInfoBar's local mute/unmute memory so unmuting restores prior volume.
  const prevVolumeRef = useRef(0.8)

  useEffect(() => {
    if (!options.enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.isComposing || isEditableTarget(event.target)) return

      const noModifiers = !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey

      // Cmd+K / Ctrl+K opens search even when another overlay is open
      if (event.code === 'KeyK' && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
        event.preventDefault()
        optionsRef.current.onOpenSearch()
        return
      }

      if (isAnyDialogOpen(optionsRef.current.anyDialogOpen)) return

      if (noModifiers && event.code === 'Space') {
        if (isInteractiveControlTarget(event.target)) return
        const { canPlay, onPlay, onPause } = optionsRef.current
        const { currentTrack, isPlaying } = usePlayerStore.getState()
        if (!canPlay || !currentTrack) return
        event.preventDefault()
        if (isPlaying) onPause()
        else onPlay()
        return
      }

      if (noModifiers && event.code === 'KeyM') {
        event.preventDefault()
        const { volume, setVolume } = usePlayerStore.getState()
        if (volume === 0) {
          setVolume(prevVolumeRef.current > 0 ? prevVolumeRef.current : 0.8)
        } else {
          prevVolumeRef.current = volume
          setVolume(0)
        }
        return
      }

      if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (event.code === 'ArrowRight' || event.code === 'ArrowLeft') {
          const { canPlay, onNext, onPrev } = optionsRef.current
          if (!canPlay || !usePlayerStore.getState().currentTrack) return
          event.preventDefault()
          if (event.code === 'ArrowRight') onNext()
          else onPrev()
          return
        }
      }

      if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        optionsRef.current.onOpenSearch()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [options.enabled])
}
