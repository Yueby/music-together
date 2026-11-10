import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HttpRequestOptions, HttpResponse, MiniAppSDK } from '@discourse-mini-app/sdk'
import { readRoomAudio, ROOM_AUDIO_MAX_BYTES, type ReadRoomAudioOptions } from './RoomAudioSource.ts'

const mp3 = new Uint8Array([0xff, 0xfb, 0x90, 0x64, 1, 2, 3, 4])
const headers: Record<string, string> = { 'Content-Type': 'audio/mpeg; charset=binary' }
const response = (body = mp3) => ({ status: 200, headers, body })
const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
function sdk(http: unknown, allowed = true): MiniAppSDK {
  return { http, permissions: { has: vi.fn(() => allowed) } } as unknown as MiniAppSDK
}
function read(http: unknown, options: Partial<ReadRoomAudioOptions> = {}) {
  return readRoomAudio({ sdk: sdk(http), roomId: 'AB_1-Z', trackId: 'netease:123', mode: 'bytes', ...options })
}
function streamFixture(
  read = vi.fn().mockResolvedValueOnce({ done: false, value: mp3 }).mockResolvedValue({ done: true }),
) {
  const reader = { read, cancel: vi.fn().mockResolvedValue(undefined) }
  const body = { getReader: vi.fn(() => reader), cancel: vi.fn().mockResolvedValue(undefined) }
  return { reader, body, response: { status: 200, headers, body } }
}

// Only fixtures and mock SDK methods are used. No native fetch or live endpoint.
afterEach(() => {
  vi.useRealTimers()
})

describe('RoomAudioSource controlled SDK transport', () => {
  it('requests only roomAudio GET identifiers, with 45s timeout, and returns owned bytes', async () => {
    const backing = new Uint8Array([0, ...mp3, 0])
    const view = backing.subarray(1, backing.length - 1)
    const request = vi.fn().mockResolvedValue(response(view))
    const platform = sdk({ request })
    const result = await read({ request }, { sdk: platform })
    expect(platform.permissions.has).toHaveBeenCalledWith('network.request')
    expect(request).toHaveBeenCalledWith('roomAudio', {
      method: 'GET',
      query: { roomId: 'AB_1-Z', trackId: 'netease:123' },
      timeoutMs: 45_000,
      responseType: 'bytes',
      signal: expect.any(AbortSignal),
      onDownloadProgress: expect.any(Function),
    })
    expect(result).toEqual({ bytes: mp3, trackId: 'netease:123' })
    expect(result.bytes.buffer).not.toBe(view.buffer)
  })

  it('buffers stream chunks and releases the reader', async () => {
    const fixture = streamFixture(
      vi
        .fn()
        .mockResolvedValueOnce({ done: false, value: mp3.subarray(0, 4) })
        .mockResolvedValueOnce({ done: false, value: mp3.subarray(4) })
        .mockResolvedValue({ done: true }),
    )
    const stream = vi.fn().mockResolvedValue(fixture.response)
    const result = await read({ stream }, { mode: 'stream' })
    expect(result.bytes).toEqual(mp3)
    expect(stream.mock.calls[0][1]).not.toHaveProperty('responseType')
    expect(fixture.reader.cancel).toHaveBeenCalledOnce()
    expect(fixture.body.cancel).not.toHaveBeenCalled()
  })

  it.each(['audio/mpeg', 'audio/flac', 'audio/ogg', 'application/octet-stream'])('accepts %s', async (contentType) => {
    await expect(
      read({
        request: vi.fn().mockResolvedValue({ status: 200, headers: { 'content-type': contentType }, body: mp3 }),
      }),
    ).resolves.toMatchObject({ trackId: 'netease:123' })
  })

  it.each(['text/html', 'application/json', ''])('rejects MIME %s and cancels the unread body', async (mime) => {
    const fixture = streamFixture()
    fixture.response.headers = { 'Content-Type': mime }
    await expect(
      read({ stream: vi.fn().mockResolvedValue(fixture.response) }, { mode: 'stream' }),
    ).rejects.toMatchObject({
      code: 'INVALID_CONTENT_TYPE',
    })
    expect(fixture.body.cancel).toHaveBeenCalledOnce()
    expect(fixture.body.getReader).not.toHaveBeenCalled()
  })

  it.each([204, 206, 301, 401, 403, 404, 500])('rejects HTTP %s and cancels its unread body', async (status) => {
    const fixture = streamFixture()
    fixture.response.status = status
    await expect(
      read({ stream: vi.fn().mockResolvedValue(fixture.response) }, { mode: 'stream' }),
    ).rejects.toMatchObject({
      code: 'HTTP_ERROR',
      message: 'HTTP_ERROR',
    })
    expect(fixture.body.cancel).toHaveBeenCalledOnce()
    expect(fixture.body.getReader).not.toHaveBeenCalled()
  })

  it.each(['abc123', 'AB123', 'AB12345', 'AB12/?'])('rejects invalid roomId %s without requesting', async (roomId) => {
    const request = vi.fn()
    await expect(read({ request }, { roomId })).rejects.toMatchObject({ code: 'INVALID_ROOM_ID' })
    expect(request).not.toHaveBeenCalled()
  })

  it.each(['', 'a'.repeat(201)])('rejects invalid track identifiers', async (trackId) => {
    const request = vi.fn()
    await expect(read({ request }, { trackId })).rejects.toMatchObject({ code: 'INVALID_TRACK_ID' })
    expect(request).not.toHaveBeenCalled()
  })

  it('requires network permission before requesting', async () => {
    const request = vi.fn()
    await expect(read({ request }, { sdk: sdk({ request }, false) })).rejects.toMatchObject({
      code: 'NETWORK_PERMISSION_REQUIRED',
    })
    expect(request).not.toHaveBeenCalled()
  })

  it('accepts exactly the 32MiB cap and rejects anything larger', async () => {
    const large = new Uint8Array(ROOM_AUDIO_MAX_BYTES)
    large.set(mp3)
    const result = await read({ request: vi.fn().mockResolvedValue(response(large)) })
    expect(result.bytes.byteLength).toBe(ROOM_AUDIO_MAX_BYTES)
    await expect(
      read({ request: vi.fn().mockResolvedValue(response(new Uint8Array(ROOM_AUDIO_MAX_BYTES + 1))) }),
    ).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' })
  })

  it('rejects an oversized declared stream length without reading', async () => {
    const fixture = streamFixture()
    fixture.response.headers = { ...headers, 'Content-Length': String(ROOM_AUDIO_MAX_BYTES + 1) }
    await expect(
      read({ stream: vi.fn().mockResolvedValue(fixture.response) }, { mode: 'stream' }),
    ).rejects.toMatchObject({
      code: 'PAYLOAD_TOO_LARGE',
    })
    expect(fixture.body.cancel).toHaveBeenCalledOnce()
    expect(fixture.body.getReader).not.toHaveBeenCalled()
  })

  it('aborts on excessive SDK progress even if the SDK swallows the callback', async () => {
    let signal: AbortSignal | undefined
    const request = vi.fn((_endpoint: string, options: HttpRequestOptions<'bytes'>) => {
      signal = options.signal
      void options.onDownloadProgress?.({ loaded: ROOM_AUDIO_MAX_BYTES + 1 })
      return new Promise<HttpResponse<Uint8Array<ArrayBuffer>>>(() => {})
    })
    await expect(read({ request })).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' })
    expect(signal?.aborted).toBe(true)
  })

  it('bounds accumulated stream bytes and releases the reader', async () => {
    const fixture = streamFixture(
      vi
        .fn()
        .mockResolvedValueOnce({ done: false, value: new Uint8Array(ROOM_AUDIO_MAX_BYTES) })
        .mockResolvedValueOnce({ done: false, value: mp3 }),
    )
    await expect(
      read({ stream: vi.fn().mockResolvedValue(fixture.response) }, { mode: 'stream' }),
    ).rejects.toMatchObject({
      code: 'PAYLOAD_TOO_LARGE',
    })
    expect(fixture.reader.read).toHaveBeenCalledTimes(2)
    expect(fixture.reader.cancel).toHaveBeenCalledOnce()
  })

  it('rejects an empty body', async () => {
    await expect(read({ request: vi.fn().mockResolvedValue(response(new Uint8Array())) })).rejects.toMatchObject({
      code: 'EMPTY_AUDIO',
    })
  })

  it('rejects a pre-abort without issuing a request', async () => {
    const controller = new AbortController()
    controller.abort()
    const request = vi.fn()
    await expect(read({ request }, { signal: controller.signal })).rejects.toMatchObject({ code: 'ABORTED' })
    expect(request).not.toHaveBeenCalled()
  })

  it('clears the timeout and external listeners after success', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    await read({ request: vi.fn().mockResolvedValue(response()) }, { signal: controller.signal })
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['abort', 'timeout', 'sdk-timeout'] as const)(
    'cancels a late stream after %s without awaiting cancellation',
    async (kind) => {
      vi.useFakeTimers()
      const late = deferred<unknown>()
      const fixture = streamFixture()
      fixture.body.cancel.mockReturnValue(new Promise(() => {}))
      const controller = new AbortController()
      const result = read(
        { stream: vi.fn().mockReturnValue(late.promise) },
        { mode: 'stream', signal: controller.signal },
      )
      const assertion = expect(result).rejects.toMatchObject({ code: kind === 'abort' ? 'ABORTED' : 'TIMEOUT' })
      if (kind === 'abort') controller.abort()
      else if (kind === 'timeout') await vi.advanceTimersByTimeAsync(45_000)
      else late.reject({ code: 'TIMEOUT', message: 'private URL' })
      await assertion
      if (kind !== 'sdk-timeout') {
        late.resolve(fixture.response)
        await Promise.resolve()
        await Promise.resolve()
        expect(fixture.body.cancel).toHaveBeenCalledOnce()
        expect(fixture.body.getReader).not.toHaveBeenCalled()
      }
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it.each(['abort', 'timeout'] as const)(
    'bounds a stalled stream reader on %s, even with stuck cancel',
    async (kind) => {
      vi.useFakeTimers()
      const reading = deferred<void>()
      const fixture = streamFixture(
        vi.fn(() => {
          reading.resolve()
          return new Promise(() => {})
        }),
      )
      fixture.reader.cancel.mockReturnValue(new Promise(() => {}))
      const controller = new AbortController()
      const result = read(
        { stream: vi.fn().mockResolvedValue(fixture.response) },
        { mode: 'stream', signal: controller.signal },
      )
      const assertion = expect(result).rejects.toMatchObject({ code: kind === 'abort' ? 'ABORTED' : 'TIMEOUT' })
      await reading.promise
      if (kind === 'abort') controller.abort()
      else await vi.advanceTimersByTimeAsync(45_000)
      await assertion
      expect(fixture.reader.cancel).toHaveBeenCalledOnce()
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it('returns only fixed errors for SDK failures', async () => {
    const secret = 'https://private.invalid/?jwt=secret'
    for (const error of [new Error(secret), { code: secret }, { code: 'UNREVIEWED_CODE', message: secret }]) {
      await expect(read({ request: vi.fn().mockRejectedValue(error) })).rejects.toMatchObject({
        code: 'REQUEST_FAILED',
        message: 'REQUEST_FAILED',
      })
    }
    await expect(read({ request: vi.fn().mockRejectedValue({ code: 'PERMISSION_DENIED' }) })).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    })
  })
})
