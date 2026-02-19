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

/** Tab highlight colors per platform */
export const PLATFORM_COLORS: Record<MusicSource, string> = {
  netease: 'data-[state=active]:text-red-500',
  tencent: 'data-[state=active]:text-green-500',
  kugou: 'data-[state=active]:text-blue-500',
}

/** VIP level display labels (Netease vipType values) */
export const VIP_LABELS: Record<number, string> = {
  0: '',
  1: 'VIP',
  10: '黑胶VIP',
  11: '黑胶VIP',
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
