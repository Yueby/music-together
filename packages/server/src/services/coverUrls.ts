import type { MusicSource } from '@music-together/shared'
import { httpsCoverUrl } from '../utils/httpsCoverUrl.js'

/** Remove NetEase's size restriction without disturbing other URL parameters. */
export function normalizeNeteaseCoverUrl(url: string): string {
  if (!url) return url
  try {
    // Several NetEase endpoints still answer with http:// artwork; the CDN serves it over https too.
    const parsed = new URL(httpsCoverUrl(url))
    parsed.searchParams.delete('param')
    return parsed.toString()
  } catch {
    return url
  }
}

/** Kugou only documents the `{size}` artwork template; leave other forms alone. */
export function normalizeKugouTemplateCoverUrl(url: string): string {
  return url.replace('{size}', '5000')
}

/**
 * Derive a separately cacheable 120px artwork URL without changing the
 * maximum-quality URL used for playback/detail views. NetEase can resize to any
 * square `size` (a cover grid asks for more than the 120px list thumbnail);
 * the other platforms only have fixed sizes and ignore it.
 */
export function deriveThumbnailCoverUrl(source: MusicSource, url: string, size = 120): string {
  if (!url) return url

  if (source === 'netease') {
    try {
      const parsed = new URL(url)
      parsed.searchParams.delete('param')
      parsed.searchParams.set('param', `${size}y${size}`)
      return parsed.toString()
    } catch {
      return url
    }
  }

  if (source === 'tencent') {
    return url.replace(/T002R\d+x\d+M000/i, 'T002R120x120M000')
  }

  // Kugou documents {size} templates. Numeric size segments are only
  // rewritten on the known artwork CDN path; arbitrary direct URLs are left
  // untouched rather than guessing what a path segment means.
  if (source === 'kugou') {
    if (url.includes('{size}')) return url.replaceAll('{size}', '120')
    try {
      const parsed = new URL(url)
      if (!/(^|\.)kugou\.com$/i.test(parsed.hostname)) return url
      const knownSizes = new Set([
        '100',
        '120',
        '150',
        '200',
        '240',
        '300',
        '320',
        '400',
        '480',
        '500',
        '600',
        '800',
        '1000',
        '1200',
        '2000',
        '3000',
        '5000',
      ])
      const segments = parsed.pathname.split('/')
      const sizeIndex = segments.findIndex((segment) => knownSizes.has(segment))
      if (sizeIndex < 0) return url
      segments[sizeIndex] = '120'
      parsed.pathname = segments.join('/')
      return parsed.toString()
    } catch {
      return url
    }
  }

  return url
}
