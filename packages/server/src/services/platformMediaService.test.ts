import { PassThrough, Readable, Writable } from 'node:stream'
import type { Response } from 'express'
import type { RoomData } from '../repositories/types.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPlatformMediaService, StreamSlots } from './platformMediaService.js'
import { MAX_MEDIA_BYTES, MediaError } from './mediaSourceRequest.js'

vi.mock('./musicProvider.js', () => ({ musicProvider: { getStreamUrl: vi.fn() } }))
afterEach(() => vi.restoreAllMocks())

const audio = Buffer.from('ID3\x04\0\0' + '\0'.repeat(26))
const input = { userId: 'mapp_stable', roomId: 'ABC_-1', trackId: 'track' }

/** Express-like response sink. With `backpressure`, it holds the first write until `hold()` is called. */
class Sink extends Writable {
  headers: Record<string, unknown> = {}
  chunks: Buffer[] = []
  statusCode = 0
  hold?: () => void
  constructor(private readonly backpressure = false) {
    super({ highWaterMark: backpressure ? 1 : 16384 })
  }
  _write(chunk: Buffer, _encoding: string, callback: () => void) {
    this.chunks.push(Buffer.from(chunk))
    if (this.backpressure) this.hold = callback
    else callback()
  }
  status(status: number) {
    this.statusCode = status
    return this
  }
  setHeader(key: string, value: unknown) {
    this.headers[key] = value
    return this
  }
}

function fixture(maxBitrate: 128 | 192 | 320 | 999 = 999) {
  const track = {
    id: 'track',
    source: 'netease',
    urlId: 'trusted-url-id',
    streamUrl: 'https://evil.test/client',
    requestedBy: 'other',
  }
  const room = {
    id: input.roomId,
    users: [{ id: input.userId, role: 'member' }],
    currentTrack: track,
    queue: [],
    audioQuality: 999,
  } as unknown as RoomData
  const rooms = { get: vi.fn(() => room as RoomData | undefined) }
  const body = new PassThrough()
  const request = vi.fn().mockResolvedValue({ body, contentType: 'audio/mpeg', length: audio.length })
  const provider = { getStreamUrl: vi.fn().mockResolvedValue('https://m1.music.126.net/server-signed') }
  const cookie = vi.fn().mockReturnValue('fixture-room-cookie')
  const slots = new StreamSlots()
  const service = createPlatformMediaService({ rooms, request, provider, cookie, slots, maxBitrate })
  const controller = new AbortController()
  const sink = new Sink()
  const run = (target: Sink = sink) => service.stream(input, target as unknown as Response, controller.signal)
  /** Both of this account's concurrent slots must be free again. */
  const expectSlotsFree = async () => {
    const a = await slots.acquire(input.userId)
    const b = await slots.acquire(input.userId)
    a()
    b()
  }
  return { room, track, rooms, body, request, provider, cookie, slots, controller, sink, run, expectSlotsFree }
}
const tick = () => new Promise<void>((resolve) => setImmediate(resolve))

describe('room-controlled media service', () => {
  it.each(['current', 'pending', 'queue'])(
    'streams a member-accessible %s track using server quality/cookie and not streamUrl',
    async (location) => {
      const f = fixture()
      if (location !== 'current') {
        f.room.currentTrack = null
        if (location === 'queue') f.room.queue = [f.track as unknown as RoomData['queue'][number]]
        else f.room.pendingPlayback = { track: f.track } as RoomData['pendingPlayback']
      }
      f.body.end(audio)
      await f.run()
      expect(f.provider.getStreamUrl).toHaveBeenCalledExactlyOnceWith(
        'netease',
        'trusted-url-id',
        999,
        'fixture-room-cookie',
      )
      expect(f.cookie).toHaveBeenCalledExactlyOnceWith('netease', input.roomId)
      expect(f.request).toHaveBeenCalledExactlyOnceWith(
        'netease',
        'https://m1.music.126.net/server-signed',
        expect.any(AbortSignal),
      )
      expect(Buffer.concat(f.sink.chunks)).toEqual(audio)
      expect(f.sink.statusCode).toBe(200)
      expect(f.sink.headers).toMatchObject({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audio.length,
        'Content-Encoding': 'identity',
        'Cache-Control': 'private, no-store, no-transform',
      })
      expect(JSON.stringify(f.sink.headers)).not.toContain('cookie')
      expect(f.body.destroyed).toBe(true)
      await f.expectSlotsFree()
    },
  )

  it('waits for a free slot when the server is busy and does not touch the provider meanwhile', async () => {
    const f = fixture()
    const busy = await Promise.all(Array.from({ length: 8 }, (_, i) => f.slots.acquire(`other${i}`)))
    f.body.end(audio)
    const running = f.run()
    await tick()
    expect(f.provider.getStreamUrl).not.toHaveBeenCalled()
    busy[0]()
    await running
    expect(Buffer.concat(f.sink.chunks)).toEqual(audio)
    busy.slice(1).forEach((release) => release())
    await f.expectSlotsFree()
  })

  it('gives up with MEDIA_ABORTED when the caller leaves while waiting for a slot', async () => {
    const f = fixture()
    const busy = await Promise.all(Array.from({ length: 8 }, (_, i) => f.slots.acquire(`other${i}`)))
    const running = f.run()
    const outcome = expect(running).rejects.toMatchObject({ code: 'MEDIA_ABORTED', status: 499 })
    await tick()
    f.controller.abort()
    await outcome
    expect(f.provider.getStreamUrl).not.toHaveBeenCalled()
    busy.forEach((release) => release())
    await f.expectSlotsFree()
  })

  it.each(['outsider', 'missing room', 'missing track', 'cross room'])(
    'denies %s before provider/cookie use',
    async (kind) => {
      const f = fixture()
      if (kind === 'outsider' || kind === 'cross room')
        f.room.users = [{ id: 'different-room-user' }] as RoomData['users']
      if (kind === 'missing room') f.rooms.get.mockReturnValue(undefined)
      if (kind === 'missing track') f.room.currentTrack = null
      await expect(f.run()).rejects.toMatchObject({ code: 'MEDIA_FORBIDDEN', status: 403 })
      expect(f.cookie).not.toHaveBeenCalled()
      expect(f.provider.getStreamUrl).not.toHaveBeenCalled()
    },
  )

  it.each(['leave', 'delete', 'source', 'urlId', 'room object'])(
    'rechecks %s while awaiting provider',
    async (kind) => {
      const f = fixture()
      let resolve!: (url: string) => void
      f.provider.getStreamUrl.mockReturnValue(
        new Promise<string>((r) => {
          resolve = r
        }),
      )
      const work = f.run()
      if (kind === 'leave') f.room.users = []
      if (kind === 'delete') f.room.currentTrack = null
      if (kind === 'source') (f.track as { source: string }).source = 'tencent'
      if (kind === 'urlId') f.track.urlId = 'replaced'
      if (kind === 'room object') f.rooms.get.mockReturnValue({ ...f.room })
      resolve('https://m1.music.126.net/late')
      await expect(work).rejects.toMatchObject({ code: 'MEDIA_FORBIDDEN' })
      expect(f.request).not.toHaveBeenCalled()
      await f.expectSlotsFree()
    },
  )

  it('rechecks access after upstream headers arrive, before streaming', async () => {
    const f = fixture()
    f.request.mockImplementation(async () => {
      f.room.users = []
      return { body: f.body, contentType: 'audio/mpeg' }
    })
    await expect(f.run()).rejects.toMatchObject({ code: 'MEDIA_FORBIDDEN' })
    expect(f.body.destroyed).toBe(true)
    expect(f.sink.chunks).toHaveLength(0)
  })

  it.each(['leave', 'delete', 'urlId', 'source', 'room object'])('stops at the next chunk on %s', async (kind) => {
    const f = fixture()
    f.request.mockResolvedValue({ body: f.body, contentType: 'audio/mpeg' })
    const work = f.run()
    const settled = work.catch((error: unknown) => error)
    f.body.write(audio)
    await vi.waitFor(() => expect(f.sink.chunks).toHaveLength(1))
    if (kind === 'leave') f.room.users = []
    if (kind === 'delete') f.room.currentTrack = null
    if (kind === 'urlId') f.track.urlId = 'changed'
    if (kind === 'source') f.track.source = 'tencent'
    if (kind === 'room object') f.rooms.get.mockReturnValue({ ...f.room })
    f.body.write(audio)
    await expect(settled).resolves.toMatchObject({ code: 'MEDIA_FORBIDDEN' })
    expect(f.sink.chunks).toHaveLength(1)
    expect(f.body.destroyed).toBe(true)
    await f.expectSlotsFree()
  })

  it('enforces the incremental 32MiB cap even without Content-Length', async () => {
    const f = fixture()
    const body = Readable.from([audio, Buffer.alloc(MAX_MEDIA_BYTES)])
    f.request.mockResolvedValue({ body, contentType: 'audio/mpeg' })
    await expect(f.run()).rejects.toMatchObject({ code: 'MEDIA_TOO_LARGE' })
    expect(body.destroyed).toBe(true)
  })

  it.each([
    ['truncated', Buffer.alloc(16), 32, 'MEDIA_LENGTH_REJECTED'],
    ['longer than declared', Buffer.alloc(40), 32, 'MEDIA_TOO_LARGE'],
    ['empty', Buffer.alloc(0), undefined, 'MEDIA_LENGTH_REJECTED'],
  ])('rejects a body that is %s', async (_name, data, length, code) => {
    const f = fixture()
    f.request.mockResolvedValue({ body: Readable.from(data.length ? [data] : []), contentType: 'audio/mpeg', length })
    await expect(f.run()).rejects.toMatchObject({ code })
  })

  it('sanitizes upstream stream failures', async () => {
    const f = fixture()
    const work = f.run()
    await tick()
    f.body.destroy(new Error('https://secret/?signed=token'))
    await expect(work).rejects.toMatchObject({ message: 'MEDIA_SOURCE_REJECTED' })
  })

  it('leaves the response untouched when the upstream fails before the first byte, so the route can answer with an error', async () => {
    const f = fixture()
    const work = f.run()
    await tick()
    f.body.destroy(new Error('connection reset'))
    await expect(work).rejects.toMatchObject({ code: 'MEDIA_SOURCE_REJECTED' })
    expect(f.sink.statusCode).toBe(0)
    expect(f.sink.headers).toEqual({})
    expect(f.sink.destroyed).toBe(false)
    expect(f.sink.chunks).toEqual([])
    await f.expectSlotsFree()
  })

  it('leaves the response untouched when access is lost before the first byte', async () => {
    const f = fixture()
    const work = f.run()
    await tick()
    f.rooms.get.mockReturnValue(undefined)
    f.body.write(audio)
    await expect(work).rejects.toMatchObject({ code: 'MEDIA_FORBIDDEN' })
    expect(f.sink.statusCode).toBe(0)
    expect(f.sink.destroyed).toBe(false)
  })

  it('propagates abort through backpressure and frees the slots', async () => {
    const f = fixture()
    const sink = new Sink(true)
    f.request.mockResolvedValue({ body: f.body, contentType: 'audio/mpeg' })
    const work = f.run(sink)
    f.body.write(audio)
    await vi.waitFor(() => expect(sink.chunks).toHaveLength(1))
    f.controller.abort()
    await expect(work).rejects.toMatchObject({ code: 'MEDIA_ABORTED' })
    expect(f.body.destroyed).toBe(true)
    await f.expectSlotsFree()
  })

  it('bounds URL resolution to 20s and the whole transfer to 5 minutes, including a provider that never answers', async () => {
    const resolveTimeout = new AbortController()
    const spy = vi
      .spyOn(AbortSignal, 'timeout')
      .mockImplementation((ms) => (ms === 20_000 ? resolveTimeout.signal : new AbortController().signal))
    const f = fixture()
    let late!: (url: string) => void
    f.provider.getStreamUrl.mockReturnValue(
      new Promise<string>((r) => {
        late = r
      }),
    )
    const work = f.run()
    await tick() // the slot is taken first, then the resolution deadline starts
    expect(spy).toHaveBeenCalledWith(5 * 60_000)
    expect(spy).toHaveBeenCalledWith(20_000)
    resolveTimeout.abort()
    await expect(work).rejects.toMatchObject({ code: 'MEDIA_SOURCE_TIMEOUT', status: 504 })
    late('https://m1.music.126.net/late')
    await tick()
    expect(f.request).not.toHaveBeenCalled()
    await f.expectSlotsFree()
  })

  it.each([
    [192, 999, 192],
    [192, 320, 192],
    [192, 128, 128],
    [320, 999, 320],
    [999, 999, 999],
  ] as const)('caps the served bitrate: ceiling %i, room quality %i -> %i kbps', async (ceiling, roomQuality, served) => {
    const f = fixture(ceiling)
    f.room.audioQuality = roomQuality
    f.body.end(audio)
    await f.run()
    expect(f.provider.getStreamUrl.mock.calls[0][2]).toBe(served)
  })

  it('falls back to lower bitrates like room playback does when the room quality has no URL', async () => {
    const f = fixture()
    f.provider.getStreamUrl
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('https://m1.music.126.net/fallback-192')
    f.body.end(audio)
    await f.run()
    expect(f.provider.getStreamUrl.mock.calls.map((call) => call[2])).toEqual([999, 320, 192])
    expect(f.request).toHaveBeenCalledExactlyOnceWith(
      'netease',
      'https://m1.music.126.net/fallback-192',
      expect.any(AbortSignal),
    )
  })

  it('leaves no unhandled rejection when the provider fails after the request was already cancelled', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
      const f = fixture()
      let fail!: (error: Error) => void
      f.provider.getStreamUrl.mockReturnValue(
        new Promise<string>((_, reject) => {
          fail = reject
        }),
      )
      const outcome = expect(f.run()).rejects.toMatchObject({ code: 'MEDIA_ABORTED' })
      await tick() // the provider call is under way
      f.controller.abort()
      await outcome
      fail(new Error('late provider failure'))
      await tick()
      await tick()
      expect(unhandled).not.toHaveBeenCalled()
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })

  it('ignores a late provider result after cancellation', async () => {
    const f = fixture()
    let late!: (url: string) => void
    f.provider.getStreamUrl.mockReturnValue(
      new Promise<string>((r) => {
        late = r
      }),
    )
    const work = f.run()
    f.controller.abort()
    await expect(work).rejects.toMatchObject({ code: 'MEDIA_ABORTED' })
    late('https://m1.music.126.net/late')
    await tick()
    expect(f.request).not.toHaveBeenCalled()
  })

  it('maps provider and source failures to sanitized codes and frees the slots', async () => {
    const f = fixture()
    f.provider.getStreamUrl.mockRejectedValueOnce(new Error('sensitive'))
    await expect(f.run()).rejects.toMatchObject({ code: 'MEDIA_SOURCE_REJECTED', message: 'MEDIA_SOURCE_REJECTED' })
    f.provider.getStreamUrl.mockResolvedValue('')
    await expect(f.run()).rejects.toMatchObject({ code: 'MEDIA_SOURCE_UNAVAILABLE' })
    f.provider.getStreamUrl.mockResolvedValue('https://m1.music.126.net/server-signed')
    f.request.mockRejectedValueOnce(new MediaError('MEDIA_SOURCE_DENIED', 403))
    await expect(f.run()).rejects.toMatchObject({ code: 'MEDIA_SOURCE_DENIED', status: 403 })
    await f.expectSlotsFree()
  })
})

describe('stream slots', () => {
  afterEach(() => vi.useRealTimers())
  /** True once the promise has settled, without waiting for it. */
  const settled = async (promise: Promise<unknown>) => {
    let done = false
    void promise.then(
      () => (done = true),
      () => (done = true),
    )
    await tick()
    return done
  }

  it('limits per account to 2 (running or waiting) and releases idempotently', async () => {
    const slots = new StreamSlots({ maxStreams: 8 })
    const a = await slots.acquire('same')
    const b = await slots.acquire('same')
    await expect(slots.acquire('same')).rejects.toMatchObject({ code: 'MEDIA_BUSY', status: 429 })
    a()
    a()
    const c = await slots.acquire('same')
    b()
    c()
    await expect(slots.acquire('same')).resolves.toBeTypeOf('function')
  })

  it('queues requests beyond the global limit and serves them in order as slots free up', async () => {
    const slots = new StreamSlots({ maxStreams: 2 })
    const first = await slots.acquire('a')
    const second = await slots.acquire('b')
    const third = slots.acquire('c')
    const fourth = slots.acquire('d')
    expect(await settled(third)).toBe(false)
    expect(await settled(fourth)).toBe(false)
    first()
    const releaseThird = await third
    expect(await settled(fourth)).toBe(false)
    second()
    const releaseFourth = await fourth
    releaseThird()
    releaseFourth()
    // Nothing leaked: both slots are free again and an account can hold its full allowance.
    const again = [await slots.acquire('c'), await slots.acquire('c')]
    expect(await settled(slots.acquire('c'))).toBe(true) // third request of the account: refused at once
    again.forEach((release) => release())
  })

  it('turns a waiting request away after the queue timeout and frees its place in line', async () => {
    vi.useFakeTimers()
    const slots = new StreamSlots({ maxStreams: 1, queueTimeoutMs: 15_000 })
    const running = await slots.acquire('a')
    const waiting = slots.acquire('b')
    const outcome = expect(waiting).rejects.toMatchObject({ code: 'MEDIA_BUSY', status: 429 })
    await vi.advanceTimersByTimeAsync(15_000)
    await outcome
    running()
    // The timed-out request must not receive the slot afterwards.
    const next = await slots.acquire('b')
    next()
  })

  it('removes an aborted request from the line without consuming a slot', async () => {
    const slots = new StreamSlots({ maxStreams: 1 })
    const running = await slots.acquire('a')
    const controller = new AbortController()
    const waiting = slots.acquire('b', controller.signal)
    const outcome = expect(waiting).rejects.toMatchObject({ code: 'MEDIA_ABORTED', status: 499 })
    controller.abort()
    await outcome
    running()
    const next = await slots.acquire('c')
    next()
    await expect(slots.acquire('b', AbortSignal.abort())).rejects.toMatchObject({ code: 'MEDIA_ABORTED' })
  })

  it('bounds the line and rejects the overflow immediately', async () => {
    const slots = new StreamSlots({ maxStreams: 1, maxQueued: 2 })
    const running = await slots.acquire('a')
    const queued = [slots.acquire('b'), slots.acquire('c')]
    await expect(slots.acquire('d')).rejects.toMatchObject({ code: 'MEDIA_BUSY', status: 429 })
    running()
    const releaseB = await queued[0]
    expect(await settled(queued[1])).toBe(false)
    releaseB()
    ;(await queued[1])()
  })
})
