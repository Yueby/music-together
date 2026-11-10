import { once } from 'node:events'
import { PassThrough, Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { Response } from 'express'
import type { AudioQuality, MusicSource } from '@music-together/shared'
import { config } from '../config.js'
import { roomRepo } from '../repositories/roomRepository.js'
import type { RoomRepository } from '../repositories/types.js'
import { musicProvider } from './musicProvider.js'
import { getAnyCookie } from './authService.js'
import { MAX_MEDIA_BYTES, MediaError, requestMediaSource } from './mediaSourceRequest.js'
import { resolveStreamUrl } from './streamUrlResolver.js'

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

/**
 * Concurrent-stream cap with a FIFO line. A whole room starts the same track at the same moment, so a full house is
 * the normal case rather than abuse: the overflow waits briefly for a free slot instead of being rejected. A user's
 * own concurrent requests (running or waiting) are still capped. The request rate is limited by `mediaStreamRateLimit`.
 */
export class StreamSlots {
  private total = 0
  private perUser = new Map<string, number>()
  private waiting: Array<() => void> = []
  private readonly maxStreams: number
  private readonly maxQueued: number
  private readonly queueTimeoutMs: number

  constructor(options: SlotOptions = {}) {
    this.maxStreams = options.maxStreams ?? config.mapp.maxStreams
    this.maxQueued = options.maxQueued ?? MAX_QUEUED
    this.queueTimeoutMs = options.queueTimeoutMs ?? QUEUE_TIMEOUT_MS
  }

  async acquire(userId: string, signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) throw new MediaError('MEDIA_ABORTED', 499)
    const own = this.perUser.get(userId) ?? 0
    if (own >= MAX_STREAMS_PER_USER) throw new MediaError('MEDIA_BUSY', 429)
    this.perUser.set(userId, own + 1)
    const forgetUser = () => {
      const left = (this.perUser.get(userId) ?? 1) - 1
      if (left) this.perUser.set(userId, left)
      else this.perUser.delete(userId)
    }
    if (this.total < this.maxStreams) {
      this.total++
    } else {
      try {
        await this.wait(signal)
      } catch (error) {
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
  private wait(signal?: AbortSignal): Promise<void> {
    if (this.waiting.length >= this.maxQueued) return Promise.reject(new MediaError('MEDIA_BUSY', 429))
    if (signal?.aborted) return Promise.reject(new MediaError('MEDIA_ABORTED', 499))
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
        const index = this.waiting.indexOf(grant)
        if (index >= 0) this.waiting.splice(index, 1)
        reject(error)
      }
      const onAbort = () => leave(new MediaError('MEDIA_ABORTED', 499))
      const timer = setTimeout(() => leave(new MediaError('MEDIA_BUSY', 429)), this.queueTimeoutMs)
      signal?.addEventListener('abort', onAbort, { once: true })
      this.waiting.push(grant)
    })
  }

  private grantNext(): void {
    while (this.total < this.maxStreams && this.waiting.length > 0) this.waiting.shift()!()
  }
}
const sharedSlots = new StreamSlots()

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
  /** Ceiling for the bitrate served here; the room's own quality still applies below it. */
  maxBitrate: AudioQuality
}
export interface RoomMediaInput {
  userId: string
  roomId: string
  trackId: string
}

export function createPlatformMediaService(dependencies: Partial<Dependencies> = {}) {
  const deps: Dependencies = {
    rooms: roomRepo,
    provider: musicProvider,
    cookie: getAnyCookie,
    request: requestMediaSource,
    slots: sharedSlots,
    maxBitrate: config.mapp.audioMaxBitrate,
    ...dependencies,
  }
  return {
    /** Streams a track the caller may currently hear in the room. Throws only sanitized MediaErrors. */
    async stream(input: RoomMediaInput, res: Response, parentSignal: AbortSignal): Promise<void> {
      const signal = AbortSignal.any([parentSignal, AbortSignal.timeout(STREAM_TIMEOUT_MS)])
      let release: (() => void) | undefined
      try {
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
        const check = () => {
          const current = accessibleTrack()
          if (current.source !== source || current.urlId !== urlId) throw new MediaError('MEDIA_FORBIDDEN', 403)
        }
        release = await deps.slots.acquire(input.userId, signal)
        const url = await abortable(
          resolveStreamUrl(
            deps.provider,
            source,
            urlId,
            // The whole file travels through this server before the mini-app can play it: cap the size.
            Math.min(room!.audioQuality, deps.maxBitrate) as AudioQuality,
            deps.cookie(source, input.roomId) ?? undefined,
          ),
          AbortSignal.any([signal, AbortSignal.timeout(RESOLVE_TIMEOUT_MS)]),
        )
        check()
        if (!url) throw new MediaError('MEDIA_SOURCE_UNAVAILABLE', 502)
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
