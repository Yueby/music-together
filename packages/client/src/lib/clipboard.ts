import { hostRuntime } from './hostRuntime'

export function canCopyText(): boolean {
  return hostRuntime.clipboard
}

export async function copyText(text: string): Promise<boolean> {
  if (!canCopyText()) return false
  try {
    const clipboard = navigator.clipboard
    if (typeof clipboard?.writeText !== 'function') return false
    await clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function getRoomShareUrl(roomId: string): string {
  return `${window.location.origin}/room/${roomId}`
}
