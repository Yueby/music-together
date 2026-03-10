import type { MusicSource, Track } from '@music-together/shared'
import { musicProvider } from './musicProvider.js'

// Keep scope minimal: only support netease <-> tencent auto fallback.
const SUPPORTED_SOURCES: ReadonlySet<Exclude<MusicSource, 'kugou'>> = new Set(['netease', 'tencent'])

export interface FallbackCandidate {
  track: Track
  score: number
}

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\s\u3000]+/g, ' ')
    .replace(/[’'"“”]/g, '')
    .replace(/[\(\)\[\]【】]/g, ' ')
    .replace(/[\-—_·•:：,，.。/\\|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(input: string): string[] {
  const t = normalizeText(input)
  if (!t) return []
  return t.split(' ').filter(Boolean)
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const A = new Set(a)
  const B = new Set(b)
  let inter = 0
  for (const x of A) if (B.has(x)) inter++
  const union = A.size + B.size - inter
  return union === 0 ? 0 : inter / union
}

function normalizeArtists(artists: string[]): string[] {
  const parts: string[] = []
  for (const a of artists) {
    const s = normalizeText(a)
    if (!s) continue
    // Split common separators and feat markers
    for (const p of s.split(/\s*(?:&|,|\/|×|feat|ft|with)\s*/g)) {
      const v = p.trim()
      if (v) parts.push(v)
    }
  }
  // De-dupe while keeping order
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of parts) {
    if (seen.has(p)) continue
    seen.add(p)
    out.push(p)
  }
  return out
}

function hasVersionTag(title: string): boolean {
  const t = normalizeText(title)
  return /(live|remix|instrumental|伴奏|纯音乐|翻唱|现场|混音)/.test(t)
}

function durationOk(original: Track, candidate: Track): boolean {
  // duration is seconds (see shared types); allow 0 when unknown
  if (!original.duration || !candidate.duration) return true
  const diff = Math.abs(original.duration - candidate.duration)
  // strict reject for huge mismatch
  if (diff > 10) return false
  return true
}

function scoreCandidate(original: Track, candidate: Track): number {
  const titleA = tokenize(original.title)
  const titleB = tokenize(candidate.title)
  const titleSim = jaccard(titleA, titleB)

  const artistsA = normalizeArtists(original.artist)
  const artistsB = normalizeArtists(candidate.artist)
  const artistSim = jaccard(artistsA, artistsB)

  // Duration score: 1 when <=3s, linearly drop to 0 at 10s
  let durationSim = 0.5
  if (original.duration && candidate.duration) {
    const diff = Math.abs(original.duration - candidate.duration)
    durationSim = diff <= 3 ? 1 : diff >= 10 ? 0 : 1 - (diff - 3) / 7
  }

  // Penalize obvious version tag mismatch (keep it conservative)
  const tagA = hasVersionTag(original.title)
  const tagB = hasVersionTag(candidate.title)
  const tagPenalty = !tagA && tagB ? 0.15 : 0

  const score = 0.5 * titleSim + 0.35 * artistSim + 0.15 * durationSim - tagPenalty
  return Math.max(0, Math.min(1, score))
}

export function getFallbackTargetSource(from: MusicSource): Exclude<MusicSource, 'kugou'> | null {
  if (from === 'netease') return 'tencent'
  if (from === 'tencent') return 'netease'
  return null
}

export async function findBestAlternativeTrack(
  original: Track,
  toSource: Exclude<MusicSource, 'kugou'>,
): Promise<FallbackCandidate | null> {
  if (!SUPPORTED_SOURCES.has(original.source as Exclude<MusicSource, 'kugou'>)) return null
  if (!SUPPORTED_SOURCES.has(toSource)) return null
  if (original.source === toSource) return null

  const artists = normalizeArtists(original.artist)
  const primaryArtist = artists[0] ?? ''
  const keyword = `${original.title} ${primaryArtist}`.trim()

  const candidates = await musicProvider.search(toSource, keyword, 8, 1)
  if (!candidates.length) return null

  const scored: FallbackCandidate[] = []
  for (const c of candidates) {
    if (!durationOk(original, c)) continue
    const score = scoreCandidate(original, c)
    scored.push({ track: c, score })
  }

  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]
  const second = scored[1]

  if (!best) return null

  // Conservative threshold to avoid wrong matches
  if (best.score < 0.82) return null
  if (second && best.score - second.score < 0.05) return null

  return best
}
