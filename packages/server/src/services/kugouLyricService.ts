import { promisify } from 'node:util'
import { unzip } from 'node:zlib'

const unzipAsync = promisify(unzip)
const KRC_ENCODE_KEY = Buffer.from([64, 71, 97, 119, 94, 50, 116, 71, 81, 54, 49, 45, 206, 210, 110, 105])
const KUGOU_LYRIC_BASE_URL = 'https://lyrics.kugou.com'
const REQUEST_TIMEOUT_MS = 10_000

export interface KrcWord {
  word: string
  offset: number
  duration: number
}

export interface KrcInfo {
  title?: string
  artist?: string
  album?: string
  by?: string
  offset?: string
  items: KrcWord[][]
}

/** AMLL LyricLine 格式（与 @applemusic-like-lyrics/core 一致，避免引入 client 依赖） */
export interface AmllLyricLine {
  words: Array<{ word: string; startTime: number; endTime: number; romanWord: string; obscene: boolean }>
  translatedLyric: string
  romanLyric: string
  startTime: number
  endTime: number
  isBG: boolean
  isDuet: boolean
}

/** 将 KRC 解析结果转为 AMLL LyricLine 格式 */
export function krcToAmllLines(krcInfo: KrcInfo): AmllLyricLine[] {
  if (!krcInfo.items?.length) return []
  return krcInfo.items.map((line) => {
    if (!line.length) {
      return {
        words: [],
        translatedLyric: '',
        romanLyric: '',
        startTime: 0,
        endTime: 0,
        isBG: false,
        isDuet: false,
      }
    }
    const words = line.map((w) => ({
      word: w.word,
      startTime: Math.round(w.offset * 1000),
      endTime: Math.round((w.offset + w.duration) * 1000),
      romanWord: '',
      obscene: false,
    }))
    const first = words[0]!
    const last = words[words.length - 1]!
    return {
      words,
      translatedLyric: '',
      romanLyric: '',
      startTime: first.startTime,
      endTime: last.endTime,
      isBG: false,
      isDuet: false,
    }
  })
}

interface KugouLyricCandidate {
  id?: string
  accesskey?: string
}

interface KugouSearchResponse {
  candidates?: KugouLyricCandidate[]
}

interface KugouDownloadResponse {
  fmt?: string
  content?: string
}

function splitLines(content: string): string[] {
  return content
    .split(/[\r\n]/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function parseWords(input: string): Array<{ word: string; offset: number; duration: number }> {
  const words: Array<{ word: string; offset: number; duration: number }> = []
  const wordPattern = /<(\d+),(\d+),(\d+)>(.*?)(?=<\d+,\d+,\d+>|$)/g

  for (const match of input.matchAll(wordPattern)) {
    words.push({
      offset: Number(match[1]),
      duration: Number(match[2]),
      word: match[4],
    })
  }

  return words
}

export function parseKrc(content: string): KrcInfo {
  const result: KrcInfo = { items: [] }
  const lines: Array<{ offset: number; words: ReturnType<typeof parseWords> }> = []
  const metadata: Array<[keyof Omit<KrcInfo, 'items'>, RegExp]> = [
    ['title', /^\[ti:([\s\S]*?)\]/],
    ['artist', /^\[ar:([\s\S]*?)\]/],
    ['album', /^\[al:([\s\S]*?)\]/],
    ['by', /^\[by:([\s\S]*?)\]/],
    ['offset', /^\[offset:([\s\S]*?)\]/],
  ]

  for (const line of splitLines(content)) {
    const metadataMatch = metadata.find(([, pattern]) => pattern.test(line))
    if (metadataMatch) {
      const [key, pattern] = metadataMatch
      result[key] = line.match(pattern)?.[1]
      continue
    }

    const lineMatch = line.match(/^((?:\[\d+,\d+\])+)([\s\S]+)$/)
    if (!lineMatch) continue

    const words = parseWords(lineMatch[2])
    for (const timeTag of lineMatch[1].match(/\[(\d+),(\d+)\]/g) ?? []) {
      const timeMatch = timeTag.match(/^\[(\d+),(\d+)\]$/)
      if (timeMatch) lines.push({ offset: Number(timeMatch[1]), words })
    }
  }

  lines.sort((a, b) => a.offset - b.offset)
  result.items = lines.map((line) =>
    line.words.map((word) => ({
      word: word.word,
      offset: (line.offset + word.offset) / 1000,
      duration: word.duration / 1000,
    })),
  )
  return result
}

export async function decodeKrc(content: Buffer): Promise<string> {
  if (content.length <= 4) throw new Error('Invalid KRC content')
  const encrypted = content.subarray(4)
  const decoded = Buffer.alloc(encrypted.length)

  for (let i = 0; i < encrypted.length; i++) {
    decoded[i] = encrypted[i] ^ KRC_ENCODE_KEY[i % KRC_ENCODE_KEY.length]
  }

  return (await unzipAsync(decoded)).toString('utf8')
}

async function fetchJson<T>(url: URL): Promise<T> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`Kugou lyric HTTP ${response.status}`)
  return (await response.json()) as T
}

export async function getKrcByHash(hash: string): Promise<KrcInfo | null> {
  const searchUrl = new URL('/search', KUGOU_LYRIC_BASE_URL)
  searchUrl.search = new URLSearchParams({
    ver: '1',
    man: 'yes',
    client: 'pc',
    hash,
  }).toString()
  const searchResult = await fetchJson<KugouSearchResponse>(searchUrl)
  const candidate = searchResult.candidates?.find((item) => item.id && item.accesskey)
  if (!candidate?.id || !candidate.accesskey) return null

  const downloadUrl = new URL('/download', KUGOU_LYRIC_BASE_URL)
  downloadUrl.search = new URLSearchParams({
    ver: '1',
    client: 'pc',
    charset: 'utf8',
    id: candidate.id,
    accesskey: candidate.accesskey,
    fmt: 'krc',
  }).toString()
  const downloadResult = await fetchJson<KugouDownloadResponse>(downloadUrl)
  if (downloadResult.fmt !== 'krc' || !downloadResult.content) return null

  const plaintext = await decodeKrc(Buffer.from(downloadResult.content, 'base64'))
  return parseKrc(plaintext)
}
