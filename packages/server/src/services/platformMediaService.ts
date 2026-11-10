import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { Response } from 'express'
import type { MusicSource } from '@music-together/shared'
import { roomRepo } from '../repositories/roomRepository.js'
import type { RoomRepository } from '../repositories/types.js'
import { musicProvider } from './musicProvider.js'
import { getAnyCookie } from './authService.js'
import { MAX_MEDIA_BYTES, MediaError, requestMediaSource } from './mediaSourceRequest.js'

const STREAM_TIMEOUT_MS = 30_000
const MAX_STREAMS = 8
const MAX_STREAMS_PER_USER = 2

/** Concurrent-stream cap. The request rate is limited by `mediaStreamRateLimit`. */
export class StreamSlots {
  private total = 0
  private perUser = new Map<string, number>()
  acquire(userId: string): () => void {
    const own = this.perUser.get(userId) ?? 0
    if (this.total >= MAX_STREAMS || own >= MAX_STREAMS_PER_USER) throw new MediaError('MEDIA_BUSY', 429)
    this.total++
    this.perUser.set(userId, own + 1)
    let released = false
    return () => {
      if (released) return
      released = true
      this.total--
      const left = (this.perUser.get(userId) ?? 1) - 1
      if (left) this.perUser.set(userId, left)
      else this.perUser.delete(userId)
    }
  }
}
const sharedSlots = new StreamSlots()

/** Legacy provider promises cannot be cancelled: stop waiting for them, and ignore their late result. */
function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
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
        release = deps.slots.acquire(input.userId)
        const url = await abortable(
          deps.provider.getStreamUrl(source, urlId, room!.audioQuality, deps.cookie(source, input.roomId) ?? undefined),
          signal,
        )
        check()
        if (!url) throw new MediaError('MEDIA_SOURCE_UNAVAILABLE', 502)
        const upstream = await deps.request(source, url, signal)
        try {
          check()
          res.status(200)
          res.setHeader('Content-Type', upstream.contentType)
          if (upstream.length !== undefined) res.setHeader('Content-Length', upstream.length)
          res.setHeader('Content-Encoding', 'identity')
          res.setHeader('Cache-Control', 'private, no-store, no-transform')
          res.setHeader('X-Content-Type-Options', 'nosniff')
          // pipeline applies backpressure, propagates cancellation and destroys both ends on failure.
          await pipeline(upstream.body, guardedBytes(upstream.length, check), res, { signal })
        } finally {
          upstream.body.destroy()
        }
      } catch (error) {
        throw signal.aborted
          ? new MediaError('MEDIA_ABORTED', 499)
          : error instanceof MediaError
            ? error
            : new MediaError('MEDIA_SOURCE_REJECTED', 502)
      } finally {
        release?.()
      }
    },
  }
}
