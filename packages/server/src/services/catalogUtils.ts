import type { Artist, Playlist } from '@music-together/shared'
import { LRUCache } from 'lru-cache'
import { deriveThumbnailCoverUrl, normalizeNeteaseCoverUrl } from './coverUrls.js'

/** Helpers shared by the NetEase catalog services (artist pages, discovery): loosely typed upstream data in, clean values out. */

export type Raw = Record<string, unknown>

export type CatalogErrorKind = 'unsupported' | 'not-found' | 'login-required' | 'upstream'

/**
 * A sanitized catalog failure (artist pages, discovery): a fixed `code` for the response body, the HTTP `status`, and a
 * `kind` the routes map to their own wire format. The message never carries upstream bodies. Upstream failures use 503,
 * not 502/504, which Cloudflare would replace with a page that has no CORS headers.
 */
export class CatalogError extends Error {
  constructor(
    readonly kind: CatalogErrorKind,
    readonly code: string,
    readonly status: number,
  ) {
    super(code)
    this.name = 'CatalogError'
  }
}

export const isRecord = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
export const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
export const count = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

/** A NetEase numeric id as a string, or null when it is anything else. */
export function numericId(value: unknown): string | null {
  const raw = typeof value === 'number' || typeof value === 'string' ? String(value).trim() : ''
  return /^\d{1,20}$/.test(raw) ? raw : null
}

/** Artwork of a NetEase entity (picUrl / img1v1Url / coverImgUrl / cover), normalized, with its square thumbnail (120px by default). */
export function neteaseCover(raw: Raw, thumbnailSize?: number): { cover: string; thumbnailCover?: string } {
  // `normalizeNeteaseCoverUrl` also upgrades http:// artwork to https, so that rule lives in one place.
  const cover = normalizeNeteaseCoverUrl(
    text(raw.picUrl) || text(raw.img1v1Url) || text(raw.coverImgUrl) || text(raw.cover),
  )
  return cover ? { cover, thumbnailCover: deriveThumbnailCoverUrl('netease', cover, thumbnailSize) } : { cover: '' }
}

/** A NetEase artist (search hit, top list, profile). `description` adds the profile blurb when the entity has one. */
export function neteaseArtist(
  raw: Raw,
  options: { description?: boolean; thumbnailSize?: number } = {},
): Artist | null {
  const artistId = numericId(raw.id)
  const name = text(raw.name)
  if (!artistId || !name) return null
  return {
    id: artistId,
    name,
    ...neteaseCover(raw, options.thumbnailSize),
    source: 'netease',
    albumCount: count(raw.albumSize),
    songCount: count(raw.musicSize),
    ...(options.description && text(raw.briefDesc) ? { description: text(raw.briefDesc) } : {}),
  }
}

/** A NetEase album as a playlist-shaped entry (its tracks are read with `type: 'album'`). */
export function neteaseAlbum(raw: Raw, thumbnailSize?: number): Playlist | null {
  const albumId = numericId(raw.id)
  const name = text(raw.name)
  if (!albumId || !name) return null
  const artist = isRecord(raw.artist) ? text(raw.artist.name) : ''
  return {
    id: albumId,
    name,
    ...neteaseCover(raw, thumbnailSize),
    trackCount: count(raw.size) ?? 0,
    source: 'netease',
    creator: artist,
  }
}

/**
 * Settle with `work`, or reject with `onTimeout()` after `ms`. The SDK promise cannot be cancelled: when the deadline
 * wins, its late failure must not become an unhandled rejection.
 */
export function withDeadline<T>(work: Promise<T>, ms: number, onTimeout: () => Error): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(onTimeout()), ms)
  })
  work.catch(() => {})
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer))
}

/**
 * TTL cache whose misses share one upstream call per key: many members opening the same page must not multiply
 * requests to the (rate-limited) NetEase endpoints. A failed load is not cached.
 */
export function sharedCache<T extends {}>(max: number, ttl: number) {
  const cache = new LRUCache<string, T>({ max, ttl })
  const inflight = new Map<string, Promise<T>>()
  return (key: string, load: () => Promise<T>): Promise<T> => {
    const hit = cache.get(key)
    if (hit) return Promise.resolve(hit)
    const running = inflight.get(key)
    if (running) return running
    const started = load()
      .then((value) => {
        cache.set(key, value)
        return value
      })
      .finally(() => inflight.delete(key))
    inflight.set(key, started)
    return started
  }
}
