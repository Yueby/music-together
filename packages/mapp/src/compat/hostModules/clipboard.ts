import { getMappHost } from '../hostBinding.ts'
import { hostRuntime } from './hostRuntime.ts'

export function canCopyText(): boolean {
  return hostRuntime.clipboard && getMappHost().canCopyText()
}

export function copyText(text: string): Promise<boolean> {
  return hostRuntime.clipboard ? getMappHost().copyText(text) : Promise.resolve(false)
}

export function getRoomShareUrl(roomId: string): string {
  return `${getMappHost().serverOrigin}/room/${roomId}`
}
