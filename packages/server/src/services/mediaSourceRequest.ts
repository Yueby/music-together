import { lookup } from 'node:dns'
import { request } from 'node:https'
import { BlockList, isIP, type LookupFunction } from 'node:net'
import type { IncomingMessage } from 'node:http'
import type { MusicSource } from '@music-together/shared'

export const MAX_MEDIA_BYTES = 32 * 1024 * 1024
const HEADER_TIMEOUT_MS = 8_000

export class MediaError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code)
  }
}

const denied = new BlockList()
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 3],
] as const)
  denied.addSubnet(address, prefix, 'ipv4')
const globalV6 = new BlockList()
globalV6.addSubnet('2000::', 3, 'ipv6')
for (const [address, prefix] of [
  ['2001::', 23], // Includes Teredo, benchmarking, ORCHID and other special assignments.
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
] as const)
  denied.addSubnet(address, prefix, 'ipv6')

export function isPublicMediaAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return !denied.check(address, 'ipv4')
  // Mapped IPv4, NAT64, link-local, ULA, multicast etc. are outside global unicast.
  return family === 6 && !address.includes('%') && globalV6.check(address, 'ipv6') && !denied.check(address, 'ipv6')
}

const CDN_SUFFIXES: Record<MusicSource, string[]> = {
  netease: ['music.126.net'],
  // `aqqmusic.tc.qq.com` (the vkey download host QQ returns today) and the older `*.music.tc.qq.com` are both under tc.qq.com.
  tencent: ['qqmusic.qq.com', 'tc.qq.com'],
  kugou: ['kugou.com'],
}

/** Only https URLs on a source's own CDN subdomains; no credentials, port or fragment. */
export function validateMediaUrl(source: MusicSource, raw: string): URL {
  try {
    const url = new URL(raw)
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.hash ||
      url.port ||
      !CDN_SUFFIXES[source]?.some((suffix) => url.hostname.endsWith('.' + suffix))
    ) {
      throw new Error()
    }
    return url
  } catch {
    throw new MediaError('MEDIA_SOURCE_REJECTED', 502)
  }
}

export interface MediaSource {
  body: IncomingMessage
  contentType: string
  length?: number
}

const AUDIO_CONTENT_TYPES = new Set([
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
])

/** Accept only a plain, full, uncompressed audio response of bounded size. */
function inspectResponse(response: IncomingMessage): Omit<MediaSource, 'body'> {
  if (response.statusCode === 401 || response.statusCode === 403) throw new MediaError('MEDIA_SOURCE_DENIED', 403)
  // We never send Range, so anything but a plain 200 (redirects included) is rejected.
  if (response.statusCode !== 200) throw new MediaError('MEDIA_SOURCE_REJECTED', 502)
  const encoding = response.headers['content-encoding']
  if (encoding !== undefined && encoding !== 'identity') throw new MediaError('MEDIA_ENCODING_REJECTED', 502)
  const contentType = response.headers['content-type']?.split(';')[0].trim().toLowerCase() ?? ''
  if (!AUDIO_CONTENT_TYPES.has(contentType)) throw new MediaError('MEDIA_TYPE_REJECTED', 502)
  const rawLength = response.headers['content-length']
  if (rawLength === undefined) return { contentType }
  if (!/^\d+$/.test(rawLength)) throw new MediaError('MEDIA_LENGTH_REJECTED', 502)
  const length = Number(rawLength)
  if (length <= 0 || length > MAX_MEDIA_BYTES) throw new MediaError('MEDIA_TOO_LARGE', 502)
  return { contentType, length }
}

/**
 * The socket may only connect to the address we validated here: every DNS answer must be
 * public, and the connection is pinned to one of them (no second resolution, no rebinding).
 */
const pinnedLookup: LookupFunction = (hostname, options, callback) => {
  const wanted = options.family === 'IPv4' ? 4 : options.family === 'IPv6' ? 6 : options.family
  lookup(hostname, { all: true, verbatim: true }, (error, records) => {
    const chosen =
      !error && records?.every((r) => isPublicMediaAddress(r.address))
        ? records.find((r) => !wanted || r.family === wanted)
        : undefined
    if (!chosen) {
      callback(new Error('MEDIA_DNS_REJECTED'), '', 4)
    } else if (options.all) {
      // Node's autoSelectFamily requests an array; pin it to one validated address, too.
      callback(null, [chosen])
    } else {
      callback(null, chosen.address, chosen.family)
    }
  })
}

/** One TLS request: no redirect, no retry, default certificate validation, cancelled by `signal`. */
export async function requestMediaSource(source: MusicSource, raw: string, signal: AbortSignal): Promise<MediaSource> {
  const url = validateMediaUrl(source, raw)
  return new Promise((resolve, reject) => {
    const upstream = request(
      url,
      {
        method: 'GET',
        agent: false,
        signal,
        headers: { Accept: 'audio/*, application/ogg, application/octet-stream', 'Accept-Encoding': 'identity' },
        lookup: pinnedLookup,
      },
      (response) => {
        clearTimeout(timer)
        try {
          resolve({ body: response, ...inspectResponse(response) })
        } catch (error) {
          response.destroy()
          upstream.destroy()
          reject(error)
        }
      },
    )
    // Covers DNS, connect and TLS as well as waiting for response headers.
    const timer = setTimeout(() => {
      reject(new MediaError('MEDIA_SOURCE_TIMEOUT', 504))
      upstream.destroy()
    }, HEADER_TIMEOUT_MS)
    // Never forward the platform's error text: it can contain the signed URL.
    upstream.on('error', () => {
      clearTimeout(timer)
      reject(signal.aborted ? new MediaError('MEDIA_ABORTED', 499) : new MediaError('MEDIA_SOURCE_REJECTED', 502))
    })
    upstream.end()
  })
}
