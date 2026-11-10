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

function fixture() {
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
  const service = createPlatformMediaService({ rooms, request, provider, cookie, slots })
  const controller = new AbortController()
  const sink = new Sink()
  const run = (target: Sink = sink) => service.stream(input, target as unknown as Response, controller.signal)
  /** Both of this account's concurrent slots must be free again. */
  const expectSlotsFree = () => {
    const a = slots.acquire(input.userId)
    const b = slots.acquire(input.userId)
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
      f.expectSlotsFree()
    },
  )

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
      f.expectSlotsFree()
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
    f.expectSlotsFree()
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
    f.expectSlotsFree()
  })

  it('bounds the whole request to 30s, including a provider that never answers', async () => {
    const timeout = new AbortController()
    const spy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal)
    const f = fixture()
    let late!: (url: string) => void
    f.provider.getStreamUrl.mockReturnValue(
      new Promise<string>((r) => {
        late = r
      }),
    )
    const work = f.run()
    expect(spy).toHaveBeenCalledWith(30_000)
    timeout.abort()
    await expect(work).rejects.toMatchObject({ code: 'MEDIA_ABORTED' })
    late('https://m1.music.126.net/late')
    await tick()
    expect(f.request).not.toHaveBeenCalled()
    f.expectSlotsFree()
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
    f.provider.getStreamUrl.mockResolvedValueOnce('')
    await expect(f.run()).rejects.toMatchObject({ code: 'MEDIA_SOURCE_UNAVAILABLE' })
    f.request.mockRejectedValueOnce(new MediaError('MEDIA_SOURCE_DENIED', 403))
    await expect(f.run()).rejects.toMatchObject({ code: 'MEDIA_SOURCE_DENIED', status: 403 })
    f.expectSlotsFree()
  })
})

describe('stream slots', () => {
  it('limits globally to 8 and per account to 2, with idempotent release', () => {
    const slots = new StreamSlots()
    const a = slots.acquire('same')
    const b = slots.acquire('same')
    expect(() => slots.acquire('same')).toThrow('MEDIA_BUSY')
    const others = Array.from({ length: 6 }, (_, i) => slots.acquire('uid' + i))
    expect(() => slots.acquire('new')).toThrow('MEDIA_BUSY')
    a()
    a()
    const c = slots.acquire('same')
    b()
    c()
    others.forEach((release) => release())
    for (let i = 0; i < 4; i++) slots.acquire('fresh' + i)
  })
})
