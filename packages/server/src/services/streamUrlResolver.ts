import type { AudioQuality, MusicSource } from '@music-together/shared'
import { logger } from '../utils/logger.js'
import type { musicProvider } from './musicProvider.js'
import { isStreamUrlExpired } from './streamUrlLifetime.js'

const BITRATE_FALLBACKS: Record<AudioQuality, AudioQuality[]> = {
  999: [320, 192, 128],
  320: [192, 128],
  192: [128],
  128: [],
}

/**
 * Try to get a stream URL at the requested bitrate. If it fails, try each
 * lower tier in order until one succeeds or all options are exhausted.
 * Shared by room playback and the platform audio endpoint, so both hear the same track in the same room.
 */
export async function resolveStreamUrl(
  provider: Pick<typeof musicProvider, 'getStreamUrl'>,
  source: MusicSource,
  urlId: string,
  bitrate: AudioQuality,
  cookie?: string,
  isValid?: () => boolean,
): Promise<string | null> {
  for (const quality of [bitrate, ...BITRATE_FALLBACKS[bitrate]]) {
    if (isValid && !isValid()) return null
    const url = await provider.getStreamUrl(source, urlId, quality, cookie)
    if (isValid && !isValid()) return null
    if (url && !isStreamUrlExpired(source, url)) {
      if (quality !== bitrate) logger.info(`Bitrate fallback: ${bitrate} -> ${quality} for ${source}/${urlId}`)
      return url
    }
  }

  return null
}
