import '../cspValidation.ts'
import type { HttpResponse, MiniAppSDK } from '@discourse-mini-app/sdk'
import { MAPP_COVER_MAX_BYTES, MAPP_METADATA_TARGETS } from '@music-together/shared'
import type { ArtworkLoader } from '../../../client/src/lib/artwork.ts'

type CoverSDK = {
  http: Pick<MiniAppSDK['http'], 'request'>
  permissions: Pick<MiniAppSDK['permissions'], 'has'>
}

/** The reviewed `musicCover` endpoint declared in the manifest (one dynamic query key: `url`). */
const COVER_ENDPOINT = MAPP_METADATA_TARGETS.cover.endpoint
const COVER_QUERY_KEY = MAPP_METADATA_TARGETS.cover.queryKeys[0]
/** Same allow-list the server applies; a cover from any other host never reaches the network. */
const COVER_HOSTS = new Set([
  'y.gtimg.cn',
  'p1.music.126.net',
  'p2.music.126.net',
  'p3.music.126.net',
  'p4.music.126.net',
  'imgessl.kugou.com',
])
const MAX_COVER_BYTES = MAPP_COVER_MAX_BYTES
/** The server only accepts a plain absolute https URL of at most this length. */
const MAX_URL_LENGTH = 2048
const MAX_CONCURRENT = 4
const TIMEOUT_MS = 15_000

type Failure =
  | 'ARTWORK_ORIGIN_REJECTED'
  | 'ARTWORK_PERMISSION_DENIED'
  | 'ARTWORK_RESPONSE_REJECTED'
  | 'ARTWORK_TOO_LARGE'
  | 'ARTWORK_REQUEST_FAILED'
  | 'ARTWORK_TIMEOUT'
  | 'ARTWORK_DISPOSED'

const failure = (code: Failure) => new Error(code)
const cancelled = () => new DOMException('ARTWORK_CANCELLED', 'AbortError')

/**
 * The address actually requested and cached: https only. CDNs often hand out `http://` covers, which are
 * upgraded, but only for the allow-listed hosts. Anything else is rejected without touching the network.
 */
function normalizeCoverUrl(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw failure('ARTWORK_ORIGIN_REJECTED')
  }
  if (
    (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
    url.length > MAX_URL_LENGTH ||
    /[\s#]/.test(url) ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    !COVER_HOSTS.has(parsed.hostname)
  ) {
    throw failure('ARTWORK_ORIGIN_REJECTED')
  }
  return parsed.protocol === 'http:' ? 'https:' + url.slice('http:'.length) : url
}

function sdkFailure(error: unknown): Error {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
  if (
    code === 'APP_UNLOADED' ||
    code === 'USER_CANCELLED' ||
    (error instanceof DOMException && error.name === 'AbortError')
  ) {
    return cancelled()
  }
  if (code === 'TIMEOUT') return failure('ARTWORK_TIMEOUT')
  if (code === 'PERMISSION_DENIED') return failure('ARTWORK_PERMISSION_DENIED')
  return failure('ARTWORK_REQUEST_FAILED')
}

/** Returns a Blob URL for an accepted response; anything else is a fixed error code. */
function toObjectUrl(response: HttpResponse<Uint8Array>): string {
  const contentType = Object.entries(response.headers)
    .find(([key]) => key.toLowerCase() === 'content-type')?.[1]
    ?.split(';')[0]
    .trim()
    .toLowerCase()
  // SVG is excluded: only raster covers are expected.
  if (response.status !== 200 || !contentType?.startsWith('image/') || contentType === 'image/svg+xml') {
    throw failure('ARTWORK_RESPONSE_REJECTED')
  }
  if (response.body.byteLength === 0) throw failure('ARTWORK_RESPONSE_REJECTED')
  if (response.body.byteLength > MAX_COVER_BYTES) throw failure('ARTWORK_TOO_LARGE')
  return URL.createObjectURL(new Blob([response.body as BlobPart], { type: contentType }))
}

interface Entry {
  promise: Promise<string>
  controller: AbortController
  /** Callers still waiting for this cover. */
  waiters: number
  settled: boolean
  objectUrl?: string
}

export interface MappCoverLoader extends ArtworkLoader {
  /** Revokes every Blob URL, cancels in-flight reads and rejects later loads. */
  dispose(): void
}

/**
 * Reads covers through the reviewed `musicCover` endpoint and exposes them as Blob URLs, as the platform
 * requires for images. One request per URL, at most four at a time; failures are not cached.
 */
export function createMappCoverLoader({ sdk }: { sdk: CoverSDK }): MappCoverLoader {
  const entries = new Map<string, Entry>()
  const queue: Array<{ grant: () => void; reject: (error: Error) => void }> = []
  let active = 0
  let disposed = false

  const release = () => {
    active--
    queue.shift()?.grant()
  }

  /** A slot is held only while a request is running; an entry cancelled while queued never starts. */
  function acquire(signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const grant = () => {
        active++
        resolve()
      }
      if (active < MAX_CONCURRENT) return grant()
      const waiter = { grant, reject }
      queue.push(waiter)
      signal.addEventListener(
        'abort',
        () => {
          const index = queue.indexOf(waiter)
          if (index >= 0) {
            queue.splice(index, 1)
            reject(cancelled())
          }
        },
        { once: true },
      )
    })
  }

  async function read(url: string, signal: AbortSignal): Promise<string> {
    await acquire(signal)
    try {
      if (signal.aborted) throw cancelled()
      let reason: Error | undefined
      const stop = (error: Error) => {
        reason ??= error
        controller.abort()
      }
      const controller = new AbortController()
      // Settle locally even if the SDK ignores abort and never settles its promise.
      const aborted = new Promise<never>((_, reject) =>
        controller.signal.addEventListener('abort', () => reject(reason ?? cancelled()), { once: true }),
      )
      const onAbort = () => stop(cancelled())
      signal.addEventListener('abort', onAbort, { once: true })
      const timer = setTimeout(() => stop(failure('ARTWORK_TIMEOUT')), TIMEOUT_MS)
      try {
        const response = await Promise.race([
          sdk.http.request(COVER_ENDPOINT, {
            method: 'GET',
            query: { [COVER_QUERY_KEY]: url },
            responseType: 'bytes',
            signal: controller.signal,
            timeoutMs: TIMEOUT_MS,
            onDownloadProgress: ({ loaded, total }) => {
              if (loaded > MAX_COVER_BYTES || (total ?? 0) > MAX_COVER_BYTES) stop(failure('ARTWORK_TOO_LARGE'))
            },
          }),
          aborted,
        ])
        return toObjectUrl(response as HttpResponse<Uint8Array>)
      } catch (error) {
        throw reason ?? (error instanceof Error && error.message.startsWith('ARTWORK_') ? error : sdkFailure(error))
      } finally {
        clearTimeout(timer)
        signal.removeEventListener('abort', onAbort)
      }
    } finally {
      release()
    }
  }

  function start(url: string): Entry {
    const controller = new AbortController()
    const entry: Entry = {
      controller,
      waiters: 0,
      settled: false,
      promise: read(url, controller.signal).then(
        (objectUrl) => {
          entry.settled = true
          if (disposed) {
            URL.revokeObjectURL(objectUrl)
            throw failure('ARTWORK_DISPOSED')
          }
          entry.objectUrl = objectUrl
          return objectUrl
        },
        (error: unknown) => {
          if (entries.get(url) === entry) entries.delete(url)
          throw error
        },
      ),
    }
    // Observe failures that no caller is left to see.
    entry.promise.catch(() => {})
    entries.set(url, entry)
    return entry
  }

  return {
    direct: false,
    load(source, signal) {
      if (disposed) return Promise.reject(failure('ARTWORK_DISPOSED'))
      if (signal?.aborted) return Promise.reject(cancelled())
      let url: string
      try {
        url = normalizeCoverUrl(source)
        if (!sdk.permissions.has('network.request')) throw failure('ARTWORK_PERMISSION_DENIED')
      } catch (error) {
        return Promise.reject(error)
      }
      const entry = entries.get(url) ?? start(url)
      entry.waiters++
      return new Promise<string>((resolve, reject) => {
        let done = false
        const leave = () => {
          if (done) return
          done = true
          signal?.removeEventListener('abort', onAbort)
          entry.waiters--
        }
        const onAbort = () => {
          leave()
          // Nobody wants an unfinished cover any more: stop it, and let a later caller start over.
          if (entry.waiters === 0 && !entry.settled) {
            if (entries.get(url) === entry) entries.delete(url)
            entry.controller.abort()
          }
          reject(cancelled())
        }
        signal?.addEventListener('abort', onAbort, { once: true })
        entry.promise.then(
          (value) => {
            leave()
            resolve(value)
          },
          (error: unknown) => {
            leave()
            reject(error)
          },
        )
      })
    },
    dispose() {
      disposed = true
      for (const entry of entries.values()) {
        entry.controller.abort()
        if (entry.objectUrl) URL.revokeObjectURL(entry.objectUrl)
      }
      entries.clear()
    },
  }
}
