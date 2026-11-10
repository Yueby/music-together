import { lookup } from 'node:dns/promises'
import { TTMLParser, toAmllLyrics, type AmllLyricLine, type TTMLParserOptions } from '@applemusic-like-lyrics/ttml'
import { DOMParser } from '@xmldom/xmldom'
import type { TTML_SOURCES } from '@music-together/shared'
import { logger } from '../utils/logger.js'
import { readBounded } from '../utils/readBounded.js'
import { isPublicMediaAddress } from './mediaSourceRequest.js'

type TtmlSource = (typeof TTML_SOURCES)[number]
/** AMLL lyric lines, exactly what the client hands to the lyric player. */
export type TtmlLines = AmllLyricLine[]

/** Upstream folder per source. The server only ever builds `<base>/<folder>/<validated id>.ttml`. */
const FOLDERS: Record<TtmlSource, string> = { netease: 'ncm-lyrics', tencent: 'qq-lyrics' }

/** Raw file cap: bounds download and parse work. Real files are 20–60 KiB. */
export const TTML_MAX_BYTES = 512 * 1024
/** Cap of the parsed JSON, kept under the platform's 1 MiB response budget so every host sees the same result. */
export const TTML_MAX_JSON_BYTES = 900 * 1024
const FETCH_TIMEOUT_MS = 6_000
const HIT_TTL_MS = 6 * 60 * 60_000
const MISS_TTL_MS = 10 * 60_000
/** A failing library must not be hit by every track change, nor delay every lyric load. */
const FAILURE_TTL_MS = 30_000
const MAX_ENTRIES = 500
const MAX_CACHE_JSON_BYTES = 16 * 1024 * 1024
const MAX_REDIRECTS = 3

/** `lines: null` means the library has no usable entry; `ok: false` is a transient failure. */
export type TtmlResult = { ok: true; lines: TtmlLines | null } | { ok: false }

interface Options {
  baseUrl: string
  fetcher?: typeof fetch
  now?: () => number
  /** Resolved addresses of a host; every one must be public before the host is contacted. */
  resolve?: (hostname: string) => Promise<string[]>
}

const resolveAddresses = async (hostname: string) =>
  (await lookup(hostname, { all: true })).map(({ address }) => address)

/**
 * Fetches and parses word-by-word TTML lyrics from the configured library.
 *
 * Parsing happens here so the clients receive plain lyric lines: the mini-app runs under Trusted Types, which
 * rejects `DOMParser.parseFromString`, and every host then shows identical results.
 * Found/missing answers are cached (the library changes rarely); failures only briefly.
 */
export function createTtmlService({ baseUrl, fetcher = fetch, now = Date.now, resolve = resolveAddresses }: Options) {
  const cache = new Map<string, { result: TtmlResult; expires: number; bytes: number }>()
  const pending = new Map<string, Promise<TtmlResult>>()
  let cachedBytes = 0

  // The public library answers with a 302 to its API host (`amlldb.…` → `api.….bikonoo.com`), so redirects must
  // be followed, but only to https hosts of the same site (a name ending in the base domain, which also rules out
  // raw IP addresses and other domains), at most MAX_REDIRECTS hops. Do not point the base URL at a shared
  // hosting suffix (`github.io`, `co.uk`): every sibling name would count as the same site.
  const baseHost = new URL(baseUrl).hostname
  const siteDomain = baseHost.split('.').length > 2 ? baseHost.split('.').slice(1).join('.') : baseHost
  const isSameSite = (url: URL) =>
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    !url.port &&
    (url.hostname === baseHost || url.hostname === siteDomain || url.hostname.endsWith('.' + siteDomain))

  // Best effort against a trusted name that resolves inside the network (the fetch resolves again itself).
  const resolvesPublicly = async (url: URL) => {
    const addresses = await resolve(url.hostname)
    return addresses.length > 0 && addresses.every(isPublicMediaAddress)
  }

  const parser = new TTMLParser({
    domParser: new DOMParser({
      onError(level) {
        if (level !== 'warning') throw new Error('TTML_PARSE_FAILED')
      },
    }) as unknown as TTMLParserOptions['domParser'],
  })

  /** Usable lines, or `null` when the body is not valid, non-empty, small enough TTML (a library without a real entry). */
  function parse(body: Buffer): { lines: TtmlLines; bytes: number } | null {
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(body)
      // TTML never needs a DTD; refusing one rules out entity-expansion payloads before any parsing.
      if (/<!(DOCTYPE|ENTITY)/i.test(text)) return null
      // The same conversion the library's own `parseTTML` applies: the rich TTML result becomes player lines.
      const { lines } = toAmllLyrics(parser.parse(text))
      if (lines.length === 0) return null
      const bytes = Buffer.byteLength(JSON.stringify(lines))
      return bytes > TTML_MAX_JSON_BYTES ? null : { lines, bytes }
    } catch {
      return null
    }
  }

  async function fetchUpstream(source: TtmlSource, id: string): Promise<{ result: TtmlResult; bytes: number }> {
    const unavailable = { result: { ok: false } as const, bytes: 0 }
    const missing = { result: { ok: true, lines: null } as const, bytes: 0 }
    try {
      const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS)
      let target = new URL(`${baseUrl}/${FOLDERS[source]}/${id}.ttml`)
      let response: Response | undefined
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        if (!(await resolvesPublicly(target))) return unavailable
        response = await fetcher(target, {
          redirect: 'manual',
          signal,
          headers: { Accept: 'application/xml, text/xml, */*', 'User-Agent': 'Mozilla/5.0' },
        })
        if (response.status < 300 || response.status >= 400) break
        const location = response.headers.get('location')
        await response.body?.cancel().catch(() => {})
        const next = location ? new URL(location, target) : undefined
        if (!next || !isSameSite(next)) return unavailable
        target = next
        response = undefined
      }
      if (!response) return unavailable
      if (response.status === 404) return missing
      if (!response.ok) return unavailable
      if (Number(response.headers.get('content-length') ?? 0) > TTML_MAX_BYTES) return missing
      const body = await readBounded(response, TTML_MAX_BYTES)
      if (!body) return missing
      const parsed = parse(body)
      return parsed ? { result: { ok: true, lines: parsed.lines }, bytes: parsed.bytes } : missing
    } catch (error) {
      logger.warn('TTML fetch failed', { source, id, reason: error instanceof Error ? error.name : 'unknown' })
      return unavailable
    }
  }

  function remember(key: string, { result, bytes }: { result: TtmlResult; bytes: number }) {
    const ttl = !result.ok ? FAILURE_TTL_MS : result.lines ? HIT_TTL_MS : MISS_TTL_MS
    const previous = cache.get(key)
    if (previous) cachedBytes -= previous.bytes
    cache.delete(key)
    cache.set(key, { result, expires: now() + ttl, bytes })
    cachedBytes += bytes
    // Map keeps insertion order: drop the oldest entries first, by count and by retained size.
    for (const [oldest, entry] of cache) {
      if (cache.size <= MAX_ENTRIES && cachedBytes <= MAX_CACHE_JSON_BYTES) break
      cache.delete(oldest)
      cachedBytes -= entry.bytes
    }
  }

  return {
    async get(source: TtmlSource, id: string): Promise<TtmlResult> {
      const key = `${source}:${id}`
      const hit = cache.get(key)
      if (hit && hit.expires > now()) return hit.result
      const inflight = pending.get(key)
      if (inflight) return inflight
      const work = fetchUpstream(source, id)
        .then((outcome) => {
          remember(key, outcome)
          return outcome.result
        })
        .finally(() => pending.delete(key))
      pending.set(key, work)
      return work
    },
  }
}
