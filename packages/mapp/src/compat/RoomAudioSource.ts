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
/** 429: no relay slot became free in time; 503: the upstream CDN hiccuped. Both usually pass within seconds. */
const RETRYABLE_STATUSES = new Set([429, 503])
const MAX_ATTEMPTS = 2
const RETRY_DELAY_MS = 2_000

function sdkError(error: unknown): RoomAudioError {
  if (error instanceof RoomAudioError) return error
  const { code, name } = (error ?? {}) as { code?: unknown; name?: unknown }
  if (code === 'TIMEOUT') return new RoomAudioError('TIMEOUT')
  if (code === 'PERMISSION_DENIED') return new RoomAudioError('PERMISSION_DENIED')
  if (code === 'USER_CANCELLED' || code === 'APP_UNLOADED' || name === 'AbortError')
    return new RoomAudioError('ABORTED')
  return new RoomAudioError('REQUEST_FAILED')
}

function checkResponse(response: { status: number; headers: Record<string, string> }): void {
  if (response.status !== 200) throw new RoomAudioError('HTTP_ERROR')
  const header = (name: string) => Object.entries(response.headers).find(([key]) => key.toLowerCase() === name)?.[1]
  const contentType = header('content-type')?.split(';', 1)[0].trim().toLowerCase() ?? ''
  // The server only serves audio; the decoder rejects anything that is not decodable.
  if (!contentType.startsWith('audio/') && contentType !== 'application/octet-stream') {
    throw new RoomAudioError('INVALID_CONTENT_TYPE')
  }
  if (Number(header('content-length')) > ROOM_AUDIO_MAX_BYTES) throw new RoomAudioError('PAYLOAD_TOO_LARGE')
}

async function readChunks(body: ReadableStreamDefaultReader<Uint8Array>, wait: <T>(op: Promise<T>) => Promise<T>) {
  const chunks: Uint8Array[] = []
  let loaded = 0
  for (;;) {
    const chunk = await wait(body.read())
    if (chunk.done) break
    loaded += chunk.value.byteLength
    if (loaded > ROOM_AUDIO_MAX_BYTES) throw new RoomAudioError('PAYLOAD_TOO_LARGE')
    chunks.push(chunk.value)
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
  const { sdk, roomId, trackId, mode, signal } = options
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
  const request = {
    method: 'GET' as const,
    query: { roomId, trackId },
    timeoutMs: TIMEOUT_MS,
    signal: controller.signal,
    onDownloadProgress: ({ loaded }: { loaded: number }) => {
      if (loaded > ROOM_AUDIO_MAX_BYTES) stop('PAYLOAD_TOO_LARGE')
    },
  }
  let stream: ReadableStream<Uint8Array> | undefined
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  try {
    let bytes!: Uint8Array<ArrayBuffer>
    for (let attempt = 1; ; attempt++) {
      const mayRetry = attempt < MAX_ATTEMPTS
      if (mode === 'bytes') {
        const response = await wait(sdk.http.request(ENDPOINT, { ...request, responseType: 'bytes' }))
        if (mayRetry && RETRYABLE_STATUSES.has(response.status)) {
          await wait(new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAY_MS)))
          continue
        }
        checkResponse(response)
        bytes = Uint8Array.from(response.body)
        break
      }
      const pending = sdk.http.stream(ENDPOINT, request)
      // A response that arrives after cancellation is never read; release its body.
      void pending.then(
        (late) => {
          if (controller.signal.aborted) void late.body.cancel().catch(() => {})
        },
        () => {},
      )
      const response = await wait(pending)
      if (mayRetry && RETRYABLE_STATUSES.has(response.status)) {
        void response.body.cancel().catch(() => {})
        await wait(new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAY_MS)))
        continue
      }
      stream = response.body
      checkResponse(response)
      reader = stream.getReader()
      // readChunks already merges into a fresh array that nothing else references; copying it again would only
      // add another whole track (up to 32 MiB) to the peak memory of a sandboxed frame.
      bytes = await readChunks(reader, wait)
      break
    }
    if (!bytes.byteLength) throw new RoomAudioError('EMPTY_AUDIO')
    if (bytes.byteLength > ROOM_AUDIO_MAX_BYTES) throw new RoomAudioError('PAYLOAD_TOO_LARGE')
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
