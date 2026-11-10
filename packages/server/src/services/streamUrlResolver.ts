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
): Promise<string | null> {
  const url = await provider.getStreamUrl(source, urlId, bitrate, cookie)
  if (url && !isStreamUrlExpired(source, url)) return url

  for (const fallback of BITRATE_FALLBACKS[bitrate]) {
    const fallbackUrl = await provider.getStreamUrl(source, urlId, fallback, cookie)
    if (fallbackUrl && !isStreamUrlExpired(source, fallbackUrl)) {
      logger.info(`Bitrate fallback: ${bitrate} -> ${fallback} for ${source}/${urlId}`)
      return fallbackUrl
    }
  }

  return null
}
