import { useEffect, useRef } from 'react'
import { tinykeys } from 'tinykeys'
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
 * - `/` and `$mod+K` (`Cmd+K` / `Ctrl+K`): open music search
 */
export function usePlayerHotkeys(options: UsePlayerHotkeysOptions) {
  const optionsRef = useRef(options)
  optionsRef.current = options

  // Mirrors SongInfoBar's local mute/unmute memory so unmuting restores prior volume.
  const prevVolumeRef = useRef(0.8)

  useEffect(() => {
    if (!options.enabled) return

    const handleOpenSearch = (event: KeyboardEvent) => {
      event.preventDefault()
      optionsRef.current.onOpenSearch()
    }

    const unsubscribe = tinykeys(
      window,
      {
        Space: (event) => {
          const { canPlay, anyDialogOpen, onPlay, onPause } = optionsRef.current
          if (isAnyDialogOpen(anyDialogOpen)) return
          if (isInteractiveControlTarget(event.target)) return
          const { currentTrack, isPlaying } = usePlayerStore.getState()
          if (!canPlay || !currentTrack) return
          event.preventDefault()
          if (isPlaying) onPause()
          else onPlay()
        },
        KeyM: (event) => {
          if (isAnyDialogOpen(optionsRef.current.anyDialogOpen)) return
          event.preventDefault()
          const { volume, setVolume } = usePlayerStore.getState()
          if (volume === 0) {
            setVolume(prevVolumeRef.current > 0 ? prevVolumeRef.current : 0.8)
          } else {
            prevVolumeRef.current = volume
            setVolume(0)
          }
        },
        'Shift+ArrowRight': (event) => {
          const { canPlay, anyDialogOpen, onNext } = optionsRef.current
          if (isAnyDialogOpen(anyDialogOpen)) return
          if (!canPlay || !usePlayerStore.getState().currentTrack) return
          event.preventDefault()
          onNext()
        },
        'Shift+ArrowLeft': (event) => {
          const { canPlay, anyDialogOpen, onPrev } = optionsRef.current
          if (isAnyDialogOpen(anyDialogOpen)) return
          if (!canPlay || !usePlayerStore.getState().currentTrack) return
          event.preventDefault()
          onPrev()
        },
        '/': (event) => {
          if (isAnyDialogOpen(optionsRef.current.anyDialogOpen)) return
          handleOpenSearch(event)
        },
        'Meta+KeyK': handleOpenSearch,
        'Control+KeyK': handleOpenSearch,
      },
      {
        ignore: (event) => event.repeat || event.isComposing || isEditableTarget(event.target),
      },
    )

    return unsubscribe
  }, [options.enabled])
}
