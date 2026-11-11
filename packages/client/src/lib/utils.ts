import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Track } from '@music-together/shared'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * A pane of a dialog that must clip its content (a virtualised list scrolls inside it) without cutting off the 3px focus
 * ring of the controls at its edges: it grows 4px past its slot on every side and pads the same amount back, so the
 * content stays where it was and the ring has room. Whatever holds the pane must not clip tighter (padding or no clip).
 */
export const CLIPPING_PANE = '-m-1 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-1'

/** Stable unique key for a track based on source + sourceId */
export const trackKey = (t: Pick<Track, 'source' | 'sourceId'>): string => `${t.source}:${t.sourceId}`
