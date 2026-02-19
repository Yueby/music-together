import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Track } from '@music-together/shared'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Stable unique key for a track based on source + sourceId */
export const trackKey = (t: Pick<Track, 'source' | 'sourceId'>): string => `${t.source}:${t.sourceId}`
