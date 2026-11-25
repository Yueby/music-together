import type { MusicSource, Track } from '@music-together/shared'
import { ERROR_CODE, EVENTS } from '@music-together/shared'
import { nanoid } from 'nanoid'
import { config } from '../config.js'
import type { TypedServer } from '../middleware/types.js'
import type { RoomData } from '../repositories/types.js'
import { logger } from '../utils/logger.js'
import { getAnyCookie } from './authService.js'
import { fallbackCooldown } from './fallbackCooldown.js'
import { musicProvider } from './musicProvider.js'
import { removeTrack } from './queueService.js'
import { resolveStreamUrl } from './streamUrlResolver.js'
import { isStreamUrlExpired } from './streamUrlLifetime.js'

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

  // A failed search just means no alternative this time.
  const candidates = await musicProvider.search(toSource, keyword, 8, 1).catch(() => [])
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

async function tryAlternativeTrack(
  io: TypedServer,
  room: RoomData,
  track: Track,
  vipRequired: boolean,
  valid: () => boolean,
): Promise<Track | null> {
  const roomId = room.id
  const fromSource = track.source
  if (!config.autoFallback.enabled || fromSource === 'kugou' || !fallbackCooldown.canTry(roomId, track.id)) return null
  const toSource = getFallbackTargetSource(fromSource)
  if (!toSource) return null

  fallbackCooldown.mark(roomId, track.id, 60_000)
  const event = { attemptId: nanoid(), fromSource, toSource, trackTitle: track.title }
  const reasonType = vipRequired ? 'VIP_REQUIRED' : 'UNKNOWN'
  io.to(roomId).emit(EVENTS.ROOM_AUTO_FALLBACK, {
    ...event,
    status: 'trying',
    reasonType,
    reasonDetail: vipRequired ? 'VIP 歌曲未登录' : undefined,
  })

  try {
    const best = await findBestAlternativeTrack(track, toSource)
    if (!valid()) return null
    if (best) {
      const { source, urlId } = best.track
      const cookie = getAnyCookie(source, roomId)
      const streamUrl = await resolveStreamUrl(musicProvider, source, urlId, room.audioQuality, cookie ?? undefined)
      if (!valid()) return null
      if (streamUrl) {
        const replacement: Track = { ...best.track, id: track.id, requestedBy: track.requestedBy, streamUrl }
        room.queue = room.queue.map((item) => (item.id === track.id ? replacement : item))
        io.to(roomId).emit(EVENTS.QUEUE_UPDATED, { queue: room.queue })
        io.to(roomId).emit(EVENTS.ROOM_AUTO_FALLBACK, { ...event, status: 'success' })
        return { ...replacement }
      }
    }
  } catch {
    if (!valid()) return null
    logger.error('Auto fallback failed', undefined, { roomId })
  }

  io.to(roomId).emit(EVENTS.ROOM_AUTO_FALLBACK, { ...event, status: 'failed', reasonType })
  return null
}

/** Resolve a playable track, removing failed queue items while the playback request is still current. */
export async function resolvePlayableTrack(
  io: TypedServer,
  room: RoomData,
  track: Track,
  valid: () => boolean,
): Promise<Track | null> {
  if (track.streamUrl && !isStreamUrlExpired(track.source, track.streamUrl)) return { ...track }

  const roomId = room.id
  const cookie = getAnyCookie(track.source, roomId)
  const vipRequired = !!track.vip && !cookie
  try {
    const streamUrl = await resolveStreamUrl(musicProvider, track.source, track.urlId, room.audioQuality, cookie ?? undefined)
    if (!valid()) return null
    if (streamUrl) return { ...track, streamUrl }

    const replacement = await tryAlternativeTrack(io, room, track, vipRequired, valid)
    if (!valid()) return null
    if (replacement) return replacement
  } catch {
    if (!valid()) return null
    logger.error('Could not resolve track stream URL', undefined, { roomId })
    removeTrack(roomId, track.id)
    io.to(roomId).emit(EVENTS.QUEUE_UPDATED, { queue: room.queue })
    return null
  }

  const hint = vipRequired ? '（VIP 歌曲，需要有用户登录 VIP 账号）' : ''
  logger.warn(`Cannot get stream URL for "${track.title}"${hint}, removing from queue`, { roomId })
  removeTrack(roomId, track.id)
  io.to(roomId).emit(EVENTS.QUEUE_UPDATED, { queue: room.queue })
  io.to(roomId).emit(EVENTS.ROOM_ERROR, {
    code: ERROR_CODE.STREAM_FAILED,
    message: `无法获取「${track.title}」的播放链接${hint}，已从列表移除`,
  })
  return null
}
