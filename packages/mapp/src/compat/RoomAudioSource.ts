import type { MiniAppSDK } from '@discourse-mini-app/sdk'

export type RoomAudioMode = 'bytes' | 'stream'
export type RoomAudioErrorCode =
  | 'INVALID_ROOM_ID'
  | 'INVALID_TRACK_ID'
  | 'NETWORK_PERMISSION_REQUIRED'
  | 'HTTP_ERROR'
  | 'INVALID_CONTENT_TYPE'
  | 'EMPTY_AUDIO'
  | 'PAYLOAD_TOO_LARGE'
  | 'ABORTED'
  | 'TIMEOUT'
  | 'PERMISSION_DENIED'
  | 'REQUEST_FAILED'

export class RoomAudioError extends Error {
  constructor(readonly code: RoomAudioErrorCode) {
    super(code)
    this.name = 'RoomAudioError'
  }
}

export interface ReadRoomAudioOptions {
  sdk: MiniAppSDK
  roomId: string
  trackId: string
  mode: RoomAudioMode
  signal?: AbortSignal
  onProgress?: (progress: RoomAudioProgress) => void
}

export interface RoomAudioProgress {
  loadedBytes: number
  totalBytes?: number
}

export interface RoomAudioResult {
  /** Owned by this call, never a view into an SDK buffer. Streaming is buffered before decoding. */
  bytes: Uint8Array<ArrayBuffer>
  trackId: string
}

// The reviewed endpoint is GET /api/mapp/audio with platform auth; only its SDK name is used here.
const ENDPOINT = 'roomAudio'
export const ROOM_AUDIO_MAX_BYTES = 32 * 1024 * 1024
/** The server may keep a request in line for up to 15 s before it starts relaying, and may be asked once more. */
const TIMEOUT_MS = 75_000
/** Relay capacity, upstream errors and deployment gateway failures usually pass within seconds. */
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504])
const MAX_ATTEMPTS = 2
const RETRY_DELAY_MS = 2_000
const PROGRESS_THROTTLE_MS = 80

function sdkError(error: unknown): RoomAudioError {
  if (error instanceof RoomAudioError) return error
  const { code, name } = (error ?? {}) as { code?: unknown; name?: unknown }
  if (code === 'TIMEOUT') return new RoomAudioError('TIMEOUT')
  if (code === 'PERMISSION_DENIED') return new RoomAudioError('PERMISSION_DENIED')
  if (code === 'USER_CANCELLED' || code === 'APP_UNLOADED' || name === 'AbortError')
    return new RoomAudioError('ABORTED')
  return new RoomAudioError('REQUEST_FAILED')
}

function checkResponse(response: { status: number; headers: Record<string, string> }): number | undefined {
  if (response.status !== 200) throw new RoomAudioError('HTTP_ERROR')
  const header = (name: string) => Object.entries(response.headers).find(([key]) => key.toLowerCase() === name)?.[1]
  const contentType = header('content-type')?.split(';', 1)[0].trim().toLowerCase() ?? ''
  // The server only serves audio; the decoder rejects anything that is not decodable.
  if (!contentType.startsWith('audio/') && contentType !== 'application/octet-stream') {
    throw new RoomAudioError('INVALID_CONTENT_TYPE')
  }
  const contentLength = header('content-length')?.trim()
  if (!contentLength || !/^\d+$/.test(contentLength)) return undefined
  const totalBytes = Number(contentLength)
  if (totalBytes > ROOM_AUDIO_MAX_BYTES) throw new RoomAudioError('PAYLOAD_TOO_LARGE')
  return Number.isInteger(totalBytes) && totalBytes > 0 ? totalBytes : undefined
}

async function readChunks(
  body: ReadableStreamDefaultReader<Uint8Array>,
  wait: <T>(op: Promise<T>) => Promise<T>,
  onProgress: (loadedBytes: number) => void,
) {
  const chunks: Uint8Array[] = []
  let loaded = 0
  for (;;) {
    const chunk = await wait(body.read())
    if (chunk.done) break
    loaded += chunk.value.byteLength
    if (loaded > ROOM_AUDIO_MAX_BYTES) throw new RoomAudioError('PAYLOAD_TOO_LARGE')
    chunks.push(chunk.value)
    onProgress(loaded)
  }
  const bytes = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

/** Only room/track identifiers go to the reviewed SDK endpoint; no URL, headers or credentials input. */
export async function readRoomAudio(options: ReadRoomAudioOptions): Promise<RoomAudioResult> {
  const { sdk, roomId, trackId, mode, signal, onProgress } = options
  if (!/^[A-Z0-9_-]{6}$/.test(roomId)) throw new RoomAudioError('INVALID_ROOM_ID')
  if (trackId.length < 1 || trackId.length > 200) throw new RoomAudioError('INVALID_TRACK_ID')
  if (signal?.aborted) throw new RoomAudioError('ABORTED')
  if (!sdk.permissions.has('network.request')) throw new RoomAudioError('NETWORK_PERMISSION_REQUIRED')

  const controller = new AbortController()
  let reason: RoomAudioErrorCode | undefined
  const stop = (code: RoomAudioErrorCode) => {
    reason ??= code
    controller.abort()
  }
  const onAbort = () => stop('ABORTED')
  signal?.addEventListener('abort', onAbort, { once: true })
  const timer = setTimeout(() => stop('TIMEOUT'), TIMEOUT_MS)
  // Uncooperative SDK promises cannot hold the caller open: every await races this.
  const aborted = new Promise<never>((_, reject) =>
    controller.signal.addEventListener('abort', () => reject(new RoomAudioError(reason ?? 'ABORTED')), { once: true }),
  )
  aborted.catch(() => {})
  const wait = <T>(operation: Promise<T>) => Promise.race([operation, aborted])
  const canRetryRequestError = (error: unknown, mayRetry: boolean) =>
    mayRetry && !controller.signal.aborted && sdkError(error).code === 'REQUEST_FAILED'
  async function backoff() {
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    try {
      await wait(new Promise<void>((resolve) => {
        retryTimer = setTimeout(resolve, RETRY_DELAY_MS + Math.floor(Math.random() * RETRY_DELAY_MS))
      }))
    } finally {
      clearTimeout(retryTimer)
    }
  }

  async function requestOnce<T extends { status: number }>(
    send: () => Promise<T>,
    mayRetry: boolean,
    discard?: (response: T) => void,
  ): Promise<T | undefined> {
    let response: T
    try {
      response = await wait(send())
    } catch (error) {
      if (!canRetryRequestError(error, mayRetry)) throw error
      await backoff()
      return
    }
    if (mayRetry && RETRYABLE_STATUSES.has(response.status)) {
      discard?.(response)
      await backoff()
      return
    }
    return response
  }
  const request = {
    method: 'GET' as const,
    query: { roomId, trackId },
    timeoutMs: TIMEOUT_MS,
    signal: controller.signal,
  }
  const enforceDownloadLimit = ({ loaded }: { loaded: number }) => {
    if (loaded > ROOM_AUDIO_MAX_BYTES) stop('PAYLOAD_TOO_LARGE')
  }
  let stream: ReadableStream<Uint8Array> | undefined
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  try {
    let bytes!: Uint8Array<ArrayBuffer>
    let totalBytes: number | undefined
    for (let attempt = 1; ; attempt++) {
      const mayRetry = attempt < MAX_ATTEMPTS
      let lastProgressAt = -Infinity
      const report = (progress: RoomAudioProgress, emit = onProgress) => {
        if (!emit || controller.signal.aborted) return
        const now = Date.now()
        if (now - lastProgressAt < PROGRESS_THROTTLE_MS) return
        lastProgressAt = now
        emit(progress)
      }
      if (mode === 'bytes') {
        // The SDK only exposes HTTP status once the bytes request resolves.
        const updates: RoomAudioProgress[] = []
        let receiving = true
        const response = await requestOnce(
          async () => {
            try {
              return await sdk.http.request(ENDPOINT, {
                ...request,
                responseType: 'bytes',
                onDownloadProgress: ({ loaded, total }) => {
                  if (!receiving || controller.signal.aborted) return
                  enforceDownloadLimit({ loaded })
                  if (onProgress && Number.isFinite(loaded) && loaded >= 0) {
                    report(
                      {
                        loadedBytes: loaded,
                        totalBytes: total && Number.isFinite(total) && total > 0 ? total : undefined,
                      },
                      (progress) => updates.push(progress),
                    )
                  }
                },
              })
            } finally {
              receiving = false
            }
          },
          mayRetry,
        )
        if (!response) continue
        checkResponse(response)
        bytes = Uint8Array.from(response.body)
        for (const update of updates) {
          if (controller.signal.aborted) break
          onProgress?.(update)
        }
        break
      }
      const response = await requestOnce(
        async () => {
          const pending = await sdk.http.stream(ENDPOINT, { ...request, onDownloadProgress: enforceDownloadLimit })
          // A response that arrives after cancellation is never read; release its body.
          if (controller.signal.aborted) void pending.body.cancel().catch(() => {})
          return pending
        },
        mayRetry,
        ({ body }) => {
          void body.cancel().catch(() => {})
        },
      )
      if (!response) continue
      stream = response.body
      totalBytes = checkResponse(response)
      report({ loadedBytes: 0, totalBytes })
      reader = stream.getReader()
      // readChunks already merges into a fresh array that nothing else references; copying it again would only
      // add another whole track (up to 32 MiB) to the peak memory of a sandboxed frame.
      try {
        bytes = await readChunks(reader, wait, (loadedBytes) => report({ loadedBytes, totalBytes }))
      } catch (error) {
        if (!canRetryRequestError(error, mayRetry)) throw error
        void reader.cancel().catch(() => {})
        reader = undefined
        stream = undefined
        await backoff()
        continue
      }
      break
    }
    if (!bytes.byteLength) throw new RoomAudioError('EMPTY_AUDIO')
    if (bytes.byteLength > ROOM_AUDIO_MAX_BYTES) throw new RoomAudioError('PAYLOAD_TOO_LARGE')
    if (controller.signal.aborted) throw new RoomAudioError(reason ?? 'ABORTED')
    onProgress?.({ loadedBytes: bytes.byteLength, totalBytes: totalBytes ?? bytes.byteLength })
    return { bytes, trackId }
  } catch (error) {
    throw reason ? new RoomAudioError(reason) : sdkError(error)
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
    controller.abort()
    // Release an unread body without extending the deadline.
    void (reader ?? stream)?.cancel().catch(() => {})
  }
}
