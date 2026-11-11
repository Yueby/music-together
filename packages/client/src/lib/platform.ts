import type { MusicSource, MyPlatformAuth, PlatformAuthStatus } from '@music-together/shared'

/** Full platform display names (used in dialogs, titles, descriptions) */
export const PLATFORM_LABELS: Record<MusicSource, string> = {
  netease: '网易云音乐',
  tencent: 'QQ 音乐',
  kugou: '酷狗音乐',
}

/** Short platform labels (used in compact UI like tabs) */
export const PLATFORM_SHORT_LABELS: Record<MusicSource, string> = {
  netease: '网易云',
  tencent: 'QQ 音乐',
  kugou: '酷狗',
}

/** A platform's brand colour as a background (its round mark in the platform picker) */
export const PLATFORM_DOT: Record<MusicSource, string> = {
  netease: 'bg-red-500',
  tencent: 'bg-green-500',
  kugou: 'bg-blue-500',
}

/** One character on a platform's round mark (the platform picker shows the mark instead of its name) */
export const PLATFORM_GLYPH: Record<MusicSource, string> = {
  netease: '云',
  tencent: 'Q',
  kugou: '酷',
}

/** Membership name of an account (empty when it has none). The level numbers differ per platform. */
export function vipLabel(platform: MusicSource, vipType: number | undefined): string {
  if (!vipType || vipType <= 0) return ''
  if (platform === 'netease') return vipType >= 10 ? '黑胶VIP' : 'VIP'
  if (platform === 'tencent') return vipType >= 2 ? 'SVIP' : 'VIP'
  if (vipType === 2) return '豪华VIP'
  if (vipType === 3) return '超级VIP'
  return 'VIP'
}

/** Find a platform's auth status from the room-wide status list */
export function getPlatformStatus(
  platform: MusicSource,
  statusList: PlatformAuthStatus[],
): PlatformAuthStatus | undefined {
  return statusList.find((s) => s.platform === platform)
}

/** Find the current user's auth status for a platform */
export function getMyPlatformStatus(platform: MusicSource, myStatusList: MyPlatformAuth[]): MyPlatformAuth | undefined {
  return myStatusList.find((s) => s.platform === platform)
}
