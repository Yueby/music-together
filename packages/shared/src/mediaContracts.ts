import type { MusicSource } from './types.js'

/**
 * Shared media relay and cover proxy contracts consumed by both `packages/server`
 * and the optional Cloudflare Worker (`deploy/cf-worker`). Keep this module free of
 * runtime dependencies so edge bundles can import it directly without pulling in Zod.
 */

/** Maximum allowed audio stream payload size (32 MiB). */
export const MAX_MEDIA_BYTES = 32 * 1024 * 1024

/** Allowed HTTPS CDN hostname suffixes per music platform (exact subdomain match: `*.<suffix>`). */
export const MEDIA_CDN_SUFFIXES: Readonly<Record<MusicSource, readonly string[]>> = {
  netease: ['music.126.net'],
  // `aqqmusic.tc.qq.com` (the vkey download host QQ returns today) and the older `*.music.tc.qq.com` are both under tc.qq.com.
  tencent: ['qqmusic.qq.com', 'tc.qq.com'],
  kugou: ['kugou.com'],
}

/** Allowed upstream audio MIME types (matched after stripping parameters and lowercasing). */
export const AUDIO_CONTENT_TYPES: readonly string[] = [
  'audio/mpeg',
  'audio/mp3',
  'audio/x-mp3',
  'audio/flac',
  'audio/x-flac',
  'audio/mp4',
  'audio/x-m4a',
  'audio/ogg',
  'application/ogg',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/vnd.wave',
  'audio/aac',
  'audio/aacp',
  'audio/x-aac',
  'audio/webm',
  'application/octet-stream',
]

/** Music CDNs the cover endpoint (Web, platform, and edge worker) may fetch from, and the mini-app may ask for. */
export const COVER_HOST_ALLOWLIST: readonly string[] = [
  'y.gtimg.cn',
  'p1.music.126.net',
  'p2.music.126.net',
  'p3.music.126.net',
  'p4.music.126.net',
  'imgessl.kugou.com',
]

/** Platform cover responses are capped lower than the Web proxy: they are held in memory as Blob URLs. */
export const MAPP_COVER_MAX_BYTES = 2 * 1024 * 1024

/** Request player-sized NetEase artwork when the caller has not already chosen a size. */
export function limitCoverSize(url: URL | string): string {
  const original = typeof url === 'string' ? url : url.href
  try {
    const parsed = new URL(original)
    if (!/^p[1-4]\.music\.126\.net$/.test(parsed.hostname) || parsed.searchParams.has('param')) return original
    parsed.searchParams.set('param', '600y600')
    return parsed.href
  } catch {
    return original
  }
}

/** Maximum cover image payload size served to Web clients (3 MiB). */
export const MAX_WEB_COVER_BYTES = 3 * 1024 * 1024

/** Supported raster image MIME types for cover responses (SVG explicitly excluded). */
export const RASTER_IMAGE_TYPES: readonly string[] = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]
