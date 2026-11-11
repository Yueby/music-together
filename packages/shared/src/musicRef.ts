import { MUSIC_SOURCES } from './constants.js'
import type { MusicSource } from './types.js'

/**
 * Looking something up by its id instead of by name: the ids platforms use, and the share links that carry them.
 * Pure parsing shared by the client (it reads a pasted link to pick the platform and kind) and the server (it only ever
 * passes a validated id on to a platform).
 */

export type MusicRefKind = 'song' | 'album' | 'playlist' | 'artist'

export interface MusicLink {
  source: MusicSource
  kind: MusicRefKind
  id: string
}

/** What a plain id looks like for each platform and kind. Anything else is not sent to the platform. */
const PLAIN_ID: Record<MusicSource, Record<MusicRefKind, RegExp>> = {
  netease: { song: /^\d{1,20}$/, album: /^\d{1,20}$/, playlist: /^\d{1,20}$/, artist: /^\d{1,20}$/ },
  // QQ Music songs and albums are addressed by a 14-character "mid"; playlists by a number.
  tencent: {
    song: /^[0-9A-Za-z]{14}$/,
    album: /^(?:[0-9A-Za-z]{14}|\d{1,12})$/,
    playlist: /^\d{1,20}$/,
    artist: /^[0-9A-Za-z]{14}$/,
  },
  // Kugou songs are addressed by a 32-character hash; albums and playlists by a number (or a collection id).
  kugou: {
    song: /^[0-9A-Fa-f]{32}$/,
    album: /^\d{1,20}$/,
    playlist: /^(?:\d{1,20}|collection_[\w-]{1,100})$/,
    artist: /^\d{1,20}$/,
  },
}

/** Plain numeric keywords shorter than this are taken as words (a year, a band name such as "1975"), not as an id. */
const MIN_NUMERIC_ID_LENGTH = 6

/**
 * Whether a keyword is shaped like an id (or is a share link) for `kind` on `source`, so a lookup is worth trying before
 * searching by name. Deliberately stricter than `normalizeMusicId`: short numbers and ordinary words must stay words.
 */
export function looksLikeMusicId(source: MusicSource, kind: MusicRefKind, input: string): boolean {
  const text = input.trim()
  if (normalizeMusicId(source, kind, text) === null) return false
  if (parseMusicLink(text)) return true
  if (/^\d+$/.test(text)) return text.length >= MIN_NUMERIC_ID_LENGTH
  // A QQ mid mixes letters and digits; fourteen letters alone is a word.
  if (/^[0-9A-Za-z]{14}$/.test(text) && source === 'tencent') return /\d/.test(text) && /[A-Za-z]/.test(text)
  return true
}

/** Whether a platform can look this kind of thing up by id. Artist pages exist for NetEase only. */
export function supportsIdLookup(source: MusicSource, kind: MusicRefKind): boolean {
  return kind !== 'artist' || source === 'netease'
}

/** The first http(s) address in a piece of text (share messages put the link among other words). */
function firstUrl(text: string): URL | null {
  const match = /https?:\/\/[^\s"'<>，。（）()]+/i.exec(text)
  if (!match) return null
  try {
    return new URL(match[0])
  } catch {
    return null
  }
}

const hostIs = (url: URL, domain: string) => url.hostname === domain || url.hostname.endsWith('.' + domain)

/** NetEase fragments carry the route and its query: `https://music.163.com/#/song?id=1`. */
function neteaseParams(url: URL): { path: string; params: URLSearchParams } {
  const fragment = url.hash.replace(/^#/, '')
  if (fragment.startsWith('/')) {
    const [path, query = ''] = fragment.split('?')
    return { path, params: new URLSearchParams(query) }
  }
  return { path: url.pathname, params: url.searchParams }
}

function parseNetease(url: URL): MusicLink | null {
  const { path, params } = neteaseParams(url)
  const kind = /\/(song|album|playlist|artist)(?:\/|$|\?)/.exec(path)?.[1] as MusicRefKind | undefined
  if (!kind) return null
  const id = params.get('id') ?? new RegExp(`/${kind}/(\\d+)`).exec(path)?.[1]
  return id && PLAIN_ID.netease[kind].test(id) ? { source: 'netease', kind, id } : null
}

function parseTencent(url: URL): MusicLink | null {
  const path = url.pathname
  const q = url.searchParams
  const candidates: [MusicRefKind, string | null | undefined][] = [
    ['song', /\/songDetail\/(\w+)/.exec(path)?.[1] ?? /\/song\/(\w+?)(?:\.html)?$/.exec(path)?.[1] ?? q.get('songmid')],
    [
      'album',
      /\/albumDetail\/(\w+)/.exec(path)?.[1] ?? /\/album\/(\w+?)(?:\.html)?$/.exec(path)?.[1] ?? q.get('albummid'),
    ],
    [
      'playlist',
      /\/playlist\/(\d+)/.exec(path)?.[1] ??
        (/playlist\.html$/.test(path) || /taoge/.test(path) ? (q.get('id') ?? q.get('disstid')) : null),
    ],
    ['artist', /\/singer\/(\w+?)(?:\.html)?$/.exec(path)?.[1] ?? q.get('singermid')],
  ]
  for (const [kind, id] of candidates) {
    if (id && PLAIN_ID.tencent[kind].test(id)) return { source: 'tencent', kind, id }
  }
  return null
}

function parseKugou(url: URL): MusicLink | null {
  const q = url.searchParams
  const hash = new URLSearchParams(url.hash.replace(/^#/, '').replace(/^\/?\??/, ''))
  const param = (name: string) => q.get(name) ?? hash.get(name)
  const path = url.pathname
  const candidates: [MusicRefKind, string | null | undefined][] = [
    ['song', param('hash')],
    ['album', param('album_id') ?? param('albumid') ?? /\/album\/(?:(?:single|info)\/)?(\d+)/.exec(path)?.[1]],
    [
      'playlist',
      param('global_collection_id') ??
        param('specialid') ??
        /\/(?:special\/single|plist\/list|plist\/index)\/(\d+)/.exec(path)?.[1] ??
        /\/(?:songlist|special)\/(\d+)/.exec(path)?.[1],
    ],
  ]
  for (const [kind, id] of candidates) {
    if (id && PLAIN_ID.kugou[kind].test(id)) return { source: 'kugou', kind, id }
  }
  return null
}

/** The platform, kind and id a share link points at, or `null` when it is not a link this app can read. */
export function parseMusicLink(input: string): MusicLink | null {
  const url = firstUrl(input)
  if (!url) return null
  if (hostIs(url, 'music.163.com')) return parseNetease(url)
  if (hostIs(url, 'qq.com')) return parseTencent(url)
  if (hostIs(url, 'kugou.com')) return parseKugou(url)
  return null
}

/**
 * The id to look up for `kind` on `source`: the text itself when it is a plain id, or the id inside a share link of
 * that same platform and kind. `null` for anything else (a link to something different is not guessed at).
 */
export function normalizeMusicId(source: MusicSource, kind: MusicRefKind, input: string): string | null {
  const text = input.trim()
  if (!text || !MUSIC_SOURCES.includes(source)) return null
  if (PLAIN_ID[source][kind].test(text)) return text
  const link = parseMusicLink(text)
  return link && link.source === source && link.kind === kind ? link.id : null
}
