import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { PassThrough, Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { Response } from 'express'
import type { AudioQuality, MusicSource } from '@music-together/shared'
import { config } from '../config.js'
import { roomRepo } from '../repositories/roomRepository.js'
import type { RoomData, RoomRepository } from '../repositories/types.js'
import { musicProvider } from './musicProvider.js'
import { getAnyCookie } from './authService.js'
import { MAX_MEDIA_BYTES, MediaError, requestMediaSource, validateMediaUrl } from './mediaSourceRequest.js'
import { resolveStreamUrl } from './streamUrlResolver.js'
import { getStreamUrlCacheTtl, isStreamUrlExpired } from './streamUrlLifetime.js'

/** Resolving the signed URL (provider calls, including bitrate fallbacks). */
const RESOLVE_TIMEOUT_MS = 20_000
/** Absolute cap for one request including the transfer: a 32 MiB track must survive a slow connection. */
const STREAM_TIMEOUT_MS = 5 * 60_000
const MAX_STREAMS_PER_USER = 2
/** Requests allowed to wait for a slot; a queued request is only a pending socket, but the line must stay bounded. */
const MAX_QUEUED = 64
/** How long a request may wait for a slot before it is turned away. */
const QUEUE_TIMEOUT_MS = 15_000

interface SlotOptions {
  maxStreams?: number
  maxQueued?: number
  queueTimeoutMs?: number
}

export type StreamPriority = 'normal' | 'low'

export interface StreamSlotsSnapshot {
  activeStreams: number
  maxStreams: number
  waitingCount: number
  maxQueued: number
  recentWaitP95Ms: number
  recentBusyCount: number
  recentEdgeResolveCount?: number
  recentFallbackCount?: number
  recentBypassCount?: number
}

const METRICS_WINDOW_MS = 30_000
const MAX_WAIT_SAMPLES = 20

/**
 * Concurrent-stream cap with separate FIFO queues for playback and preloads. A whole room can start a track at once,
 * so overflow waits briefly for a free slot. Each user's running and waiting requests share a cap.
 */
export class StreamSlots {
  private total = 0
  private perUser = new Map<string, number>()
  private waiting: Array<() => void> = []
  private lowWaiting: Array<() => void> = []
  private waitSamples: Array<{ at: number; ms: number }> = []
  private busyEvents: number[] = []
  private edgeResolveEvents: number[] = []
  private fallbackEvents: number[] = []
  private bypassEvents: number[] = []
  private readonly maxStreams: number
  private readonly maxQueued: number
  private readonly queueTimeoutMs: number

  constructor(options: SlotOptions = {}) {
    this.maxStreams = options.maxStreams ?? config.mapp.maxStreams
    this.maxQueued = options.maxQueued ?? MAX_QUEUED
    this.queueTimeoutMs = options.queueTimeoutMs ?? QUEUE_TIMEOUT_MS
  }

  private pruneMetrics(now: number): void {
    const cutoff = now - METRICS_WINDOW_MS
    while (this.waitSamples.length > 0 && this.waitSamples[0]!.at < cutoff) this.waitSamples.shift()
    while (this.busyEvents.length > 0 && this.busyEvents[0]! < cutoff) this.busyEvents.shift()
    while (this.edgeResolveEvents.length > 0 && this.edgeResolveEvents[0]! < cutoff) this.edgeResolveEvents.shift()
    while (this.fallbackEvents.length > 0 && this.fallbackEvents[0]! < cutoff) this.fallbackEvents.shift()
    while (this.bypassEvents.length > 0 && this.bypassEvents[0]! < cutoff) this.bypassEvents.shift()
  }

  private recordWait(ms: number): void {
    const now = Date.now()
    this.pruneMetrics(now)
    this.waitSamples.push({ at: now, ms })
    if (this.waitSamples.length > MAX_WAIT_SAMPLES) this.waitSamples.shift()
  }

  private recordBusy(): void {
    const now = Date.now()
    this.pruneMetrics(now)
    this.busyEvents.push(now)
  }

  recordEdgeResolve(): void {
    const now = Date.now()
    this.pruneMetrics(now)
    this.edgeResolveEvents.push(now)
  }

  recordRelayFallback(): void {
    const now = Date.now()
    this.pruneMetrics(now)
    this.fallbackEvents.push(now)
  }

  recordRelayBypass(): void {
    const now = Date.now()
    this.pruneMetrics(now)
    this.bypassEvents.push(now)
  }

  getSnapshot(): StreamSlotsSnapshot {
    this.pruneMetrics(Date.now())
    let recentWaitP95Ms = 0
    if (this.waitSamples.length > 0) {
      const sorted = this.waitSamples.map((s) => s.ms).sort((a, b) => a - b)
      const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))
      recentWaitP95Ms = sorted[idx]!
    }
    return {
      activeStreams: this.total,
      maxStreams: this.maxStreams,
      waitingCount: this.waiting.length,
      maxQueued: this.maxQueued,
      recentWaitP95Ms,
      recentBusyCount: this.busyEvents.length,
      recentEdgeResolveCount: this.edgeResolveEvents.length,
      recentFallbackCount: this.fallbackEvents.length,
      recentBypassCount: this.bypassEvents.length,
    }
  }

  private canGrant(priority: StreamPriority): boolean {
    if (priority === 'normal') return this.total < this.maxStreams
    const reserved = this.maxStreams > 1 ? 1 : 0
    return this.waiting.length === 0 && this.total < this.maxStreams - reserved
  }

  async acquire(userId: string, signal?: AbortSignal, options?: { priority?: StreamPriority }): Promise<() => void> {
    const priority = options?.priority ?? 'normal'
    if (signal?.aborted) throw new MediaError('MEDIA_ABORTED', 499)
    const own = this.perUser.get(userId) ?? 0
    if (own >= MAX_STREAMS_PER_USER) throw new MediaError('MEDIA_BUSY', 429)
    this.perUser.set(userId, own + 1)
    const forgetUser = () => {
      const left = (this.perUser.get(userId) ?? 1) - 1
      if (left) this.perUser.set(userId, left)
      else this.perUser.delete(userId)
    }
    if (this.canGrant(priority)) {
      this.total++
    } else {
      const waitedFrom = Date.now()
      try {
        await this.wait(priority, signal)
        if (priority === 'normal') this.recordWait(Date.now() - waitedFrom)
      } catch (error) {
        if (priority === 'normal' && error instanceof MediaError && error.code === 'MEDIA_BUSY') this.recordBusy()
        forgetUser()
        throw error
      }
    }
    let released = false
    return () => {
      if (released) return
      released = true
      this.total--
      forgetUser()
      this.grantNext()
    }
  }

  /** Resolves once a slot has been handed over (already counted in `total`). */
  private wait(priority: StreamPriority, signal?: AbortSignal): Promise<void> {
    if (this.waiting.length + this.lowWaiting.length >= this.maxQueued) {
      return Promise.reject(new MediaError('MEDIA_BUSY', 429))
    }
    if (signal?.aborted) return Promise.reject(new MediaError('MEDIA_ABORTED', 499))
    const queue = priority === 'normal' ? this.waiting : this.lowWaiting
    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
      }
      const grant = () => {
        cleanup()
        this.total++
        resolve()
      }
      const leave = (error: MediaError) => {
        cleanup()
        const index = queue.indexOf(grant)
        if (index >= 0) queue.splice(index, 1)
        reject(error)
      }
      const onAbort = () => leave(new MediaError('MEDIA_ABORTED', 499))
      const timer = setTimeout(() => leave(new MediaError('MEDIA_BUSY', 429)), this.queueTimeoutMs)
      signal?.addEventListener('abort', onAbort, { once: true })
      queue.push(grant)
    })
  }

  private grantNext(): void {
    while (this.total < this.maxStreams && this.waiting.length > 0) this.waiting.shift()!()
    while (this.lowWaiting.length > 0 && this.canGrant('low')) this.lowWaiting.shift()!()
  }
}
const sharedSlots = new StreamSlots()

/** Snapshot of mini-app audio relay concurrency and recent waiting pressure. */
export function getStreamSlotsSnapshot(): StreamSlotsSnapshot {
  return sharedSlots.getSnapshot()
}

/** Record a trusted edge-relay URL resolution (`resolve-v1`) in the shared telemetry window. */
export function recordEdgeRelayResolve(): void {
  sharedSlots.recordEdgeResolve()
}

/** Record a trusted edge-relay fallback to VPS streaming (`fallback-v1`) in the shared telemetry window. */
export function recordEdgeRelayFallback(): void {
  sharedSlots.recordRelayFallback()
}

export function recordEdgeRelayBypass(): void {
  sharedSlots.recordRelayBypass()
}

/** Legacy provider promises cannot be cancelled: stop waiting for them, and ignore their late result. */
function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  // Whatever happens, `work` must always have a rejection handler: once we stop waiting, its failure is not ours.
  work.catch(() => {})
  return new Promise((resolve, reject) => {
    const abort = () => reject(new MediaError('MEDIA_ABORTED', 499))
    if (signal.aborted) return abort()
    signal.addEventListener('abort', abort, { once: true })
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

/** Enforces the byte cap and declared length, and re-checks room access before every chunk. */
function guardedBytes(declaredLength: number | undefined, checkAccess: () => void): Transform {
  let size = 0
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      try {
        checkAccess()
        size += chunk.length
        if (size > MAX_MEDIA_BYTES || (declaredLength !== undefined && size > declaredLength)) {
          throw new MediaError('MEDIA_TOO_LARGE', 502)
        }
        callback(null, chunk)
      } catch (error) {
        callback(error as Error)
      }
    },
    flush(callback) {
      const truncated = size === 0 || (declaredLength !== undefined && size !== declaredLength)
      callback(truncated ? new MediaError('MEDIA_LENGTH_REJECTED', 502) : null)
    },
  })
}

interface Dependencies {
  rooms: Pick<RoomRepository, 'get'>
  provider: Pick<typeof musicProvider, 'getStreamUrl'>
  cookie: (source: MusicSource, roomId: string) => string | null
  request: typeof requestMediaSource
  slots: StreamSlots
  /** Ceiling for direct VPS / fallback streaming; the room's own quality still applies below it. */
  maxBitrate: AudioQuality
  /** Ceiling for edge-relayed URL resolution (`resolve-v1`); defaults to `config.mapp.relayAudioMaxBitrate`. */
  relayMaxBitrate: AudioQuality
}
export interface RoomMediaInput {
  userId: string
  roomId: string
  trackId: string
}

export interface ResolvedRoomMedia {
  v: 1
  source: MusicSource
  url: string
}

export function createPlatformMediaService(dependencies: Partial<Dependencies> = {}) {
  const maxBitrate = dependencies.maxBitrate ?? config.mapp.audioMaxBitrate
  const relayMaxBitrate =
    dependencies.relayMaxBitrate ??
    (dependencies.maxBitrate !== undefined ? maxBitrate : config.mapp.relayAudioMaxBitrate)
  const deps: Dependencies = {
    rooms: roomRepo,
    provider: musicProvider,
    cookie: getAnyCookie,
    request: requestMediaSource,
    slots: sharedSlots,
    ...dependencies,
    maxBitrate,
    relayMaxBitrate,
  }
  const roomUrlState = new WeakMap<
    RoomData,
    {
      cache: Map<string, { url: string; expiresAt: number }>
      inFlight: Map<string, Promise<string | null>>
    }
  >()

  function resolveRoomUrl(
    room: RoomData,
    roomId: string,
    source: MusicSource,
    urlId: string,
    bitrateCeiling: AudioQuality,
  ): Promise<string | null> {
    // Cap bitrate according to the delivery path (VPS direct vs edge relay).
    const bitrate = Math.min(room.audioQuality, bitrateCeiling) as AudioQuality
    const cookie = deps.cookie(source, roomId)
    const cookieHash = cookie ? createHash('sha256').update(cookie).digest('hex').slice(0, 16) : 'anon'
    const key = `${source}:${urlId}:${bitrate}:${cookieHash}`
    let state = roomUrlState.get(room)
    if (!state) {
      state = { cache: new Map(), inFlight: new Map() }
      roomUrlState.set(room, state)
    }
    const { cache, inFlight } = state
    const cached = cache.get(key)
    const now = Date.now()
    if (cached && now < cached.expiresAt && !isStreamUrlExpired(source, cached.url, now)) {
      return Promise.resolve(cached.url)
    }
    cache.delete(key)
    const pending = inFlight.get(key)
    if (pending) return pending

    // The provider is shared by callers, so only its own deadline can end the shared lookup.
    const work = abortable(
      resolveStreamUrl(deps.provider, source, urlId, bitrate, cookie ?? undefined),
      AbortSignal.timeout(RESOLVE_TIMEOUT_MS),
    )
      .then((url) => {
        const resolvedAt = Date.now()
        if (url && !isStreamUrlExpired(source, url, resolvedAt)) {
          const ttl = Math.min(getStreamUrlCacheTtl(source, url, resolvedAt), 5 * 60_000)
          cache.set(key, { url, expiresAt: resolvedAt + ttl })
          if (cache.size > 64) cache.delete(cache.keys().next().value!)
        }
        return url
      })
      .finally(() => inFlight.delete(key))
    work.catch(() => {})
    inFlight.set(key, work)
    return work
  }

  function prepareAccess(input: RoomMediaInput, bitrateCeiling: AudioQuality) {
    const room = deps.rooms.get(input.roomId)
    // The caller must still be in the same room object and the track must still be playable there.
    const accessibleTrack = () => {
      if (!room || deps.rooms.get(input.roomId) !== room || !room.users.some((u) => u.id === input.userId)) {
        throw new MediaError('MEDIA_FORBIDDEN', 403)
      }
      const track = [room.currentTrack, room.pendingPlayback?.track, ...room.queue].find(
        (t) => t?.id === input.trackId,
      )
      if (!track) throw new MediaError('MEDIA_FORBIDDEN', 403)
      return track
    }
    // The URL comes from the server-side provider, never from client-supplied track data.
    const { source, urlId } = accessibleTrack()
    const priority: StreamPriority =
      room!.currentTrack?.id === input.trackId || room!.pendingPlayback?.track?.id === input.trackId
        ? 'normal'
        : 'low'
    const check = () => {
      const current = accessibleTrack()
      if (current.source !== source || current.urlId !== urlId) throw new MediaError('MEDIA_FORBIDDEN', 403)
    }
    const resolveUrl = async (signal: AbortSignal) => {
      const url = await abortable(
        resolveRoomUrl(room!, input.roomId, source, urlId, bitrateCeiling),
        AbortSignal.any([signal, AbortSignal.timeout(RESOLVE_TIMEOUT_MS)]),
      )
      check()
      if (!url) throw new MediaError('MEDIA_SOURCE_UNAVAILABLE', 502)
      return url
    }
    return { source, priority, check, resolveUrl }
  }

  return {
    /**
     * Resolves and validates a room-accessible CDN URL without consuming `StreamSlots`.
     * Used by the optional Cloudflare Worker edge relay (`resolve-v1`).
     */
    async resolve(input: RoomMediaInput, parentSignal: AbortSignal): Promise<ResolvedRoomMedia> {
      try {
        if (parentSignal.aborted) throw new MediaError('MEDIA_ABORTED', 499)
        const { source, resolveUrl } = prepareAccess(input, deps.relayMaxBitrate)
        const url = await resolveUrl(parentSignal)
        validateMediaUrl(source, url)
        return { v: 1, source, url }
      } catch (error) {
        if (parentSignal.aborted) throw new MediaError('MEDIA_ABORTED', 499)
        if (error instanceof MediaError && error.code === 'MEDIA_ABORTED') {
          throw new MediaError('MEDIA_SOURCE_TIMEOUT', 504)
        }
        throw error instanceof MediaError ? error : new MediaError('MEDIA_SOURCE_REJECTED', 502)
      }
    },

    /** Streams a track the caller may currently hear in the room. Throws only sanitized MediaErrors. */
    async stream(input: RoomMediaInput, res: Response, parentSignal: AbortSignal): Promise<void> {
      const signal = AbortSignal.any([parentSignal, AbortSignal.timeout(STREAM_TIMEOUT_MS)])
      let release: (() => void) | undefined
      try {
        if (signal.aborted) throw new MediaError('MEDIA_ABORTED', 499)
        const { source, priority, check, resolveUrl } = prepareAccess(input, deps.maxBitrate)
        let url = await resolveUrl(signal)
        release = await deps.slots.acquire(input.userId, signal, { priority })
        check()
        if (signal.aborted) throw new MediaError('MEDIA_ABORTED', 499)
        if (isStreamUrlExpired(source, url)) url = await resolveUrl(signal)
        const upstream = await deps.request(source, url, signal)
        try {
          check()
          // Upstream and guard run into a staging stream first. A failure before the first byte (upstream
          // reset, empty body, access lost) then still reaches the caller as an error response with CORS headers:
          // piping straight into `res` would destroy its socket instead, and a proxy in front turns that into a
          // bare 502 that the browser can only report as a CORS error.
          const staged = new PassThrough()
          const transfer = pipeline(upstream.body, guardedBytes(upstream.length, check), staged, { signal })
          transfer.catch(() => {}) // its outcome is observed through `staged`
          const chunks = staged[Symbol.asyncIterator]()
          const first = await chunks.next()
          if (first.done) throw new MediaError('MEDIA_LENGTH_REJECTED', 502)
          res.status(200)
          res.setHeader('Content-Type', upstream.contentType)
          if (upstream.length !== undefined) res.setHeader('Content-Length', upstream.length)
          res.setHeader('Content-Encoding', 'identity')
          res.setHeader('Cache-Control', 'private, no-store, no-transform')
          res.setHeader('X-Content-Type-Options', 'nosniff')
          if (!res.write(first.value)) await once(res, 'drain', { signal })
          // pipeline applies backpressure, propagates cancellation and destroys both ends on failure.
          await pipeline(Readable.from(chunks), res, { signal })
        } finally {
          upstream.body.destroy()
        }
      } catch (error) {
        if (signal.aborted) throw new MediaError('MEDIA_ABORTED', 499)
        // Only the URL-resolution deadline can abort while the request itself is still live.
        if (error instanceof MediaError && error.code === 'MEDIA_ABORTED') throw new MediaError('MEDIA_SOURCE_TIMEOUT', 504)
        throw error instanceof MediaError ? error : new MediaError('MEDIA_SOURCE_REJECTED', 502)
      } finally {
        release?.()
      }
    },
  }
}
