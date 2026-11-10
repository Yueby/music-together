import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMappCoverLoader } from './coverLoader.ts'

const COVER = 'https://p1.music.126.net/abc/cover.jpg'
const image = (bytes = 8, contentType = 'image/jpeg') => ({
  status: 200,
  headers: { 'content-type': contentType },
  body: new Uint8Array(bytes),
})

type Request = ReturnType<typeof vi.fn>
function setup(request: Request = vi.fn(async () => image()), hasNetwork = true) {
  const sdk = {
    http: { request },
    permissions: { has: vi.fn((permission: string) => hasNetwork && permission === 'network.request') },
  }
  return { request, loader: createMappCoverLoader({ sdk: sdk as never }) }
}
const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

let created: Blob[]
let revoked: string[]
beforeEach(() => {
  created = []
  revoked = []
  let id = 0
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    created.push(blob as Blob)
    return `blob:cover-${++id}`
  })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
    revoked.push(url)
  })
})
afterEach(() => vi.restoreAllMocks())

describe('createMappCoverLoader', () => {
  it('reads the cover through the reviewed endpoint and returns a Blob URL', async () => {
    const { loader, request } = setup()
    await expect(loader.load(COVER)).resolves.toBe('blob:cover-1')
    expect(request).toHaveBeenCalledExactlyOnceWith(
      'musicCover',
      expect.objectContaining({ method: 'GET', query: { url: COVER }, responseType: 'bytes' }),
    )
    expect(created[0].type).toBe('image/jpeg')
    expect(created[0].size).toBe(8)
    expect(loader.direct).toBe(false)
  })

  it('upgrades http covers on allow-listed hosts to https and caches under the upgraded URL', async () => {
    const { loader, request } = setup()
    const first = await loader.load('http://p3.music.126.net/x.jpg')
    const second = await loader.load('https://p3.music.126.net/x.jpg')
    expect(first).toBe(second)
    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0][1].query).toEqual({ url: 'https://p3.music.126.net/x.jpg' })
  })

  it('shares one request between concurrent callers', async () => {
    const reply = deferred<ReturnType<typeof image>>()
    const { loader, request } = setup(vi.fn(() => reply.promise))
    const a = loader.load(COVER)
    const b = loader.load(COVER)
    reply.resolve(image())
    await expect(Promise.all([a, b])).resolves.toEqual(['blob:cover-1', 'blob:cover-1'])
    expect(request).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['another host', 'https://evil.example/cover.jpg'],
    ['a look-alike host', 'https://p1.music.126.net.evil.example/c.jpg'],
    ['credentials', 'https://user:pw@p1.music.126.net/c.jpg'],
    ['an explicit port', 'https://p1.music.126.net:8443/c.jpg'],
    ['a fragment', 'https://p1.music.126.net/c.jpg#x'],
    ['whitespace', 'https://p1.music.126.net/c .jpg'],
    ['an overlong URL', 'https://p1.music.126.net/' + 'a'.repeat(2100)],
    ['another scheme', 'ftp://p1.music.126.net/c.jpg'],
    ['not a URL', 'not a url'],
  ])('never sends %s to the network', async (_name, url) => {
    const { loader, request } = setup()
    await expect(loader.load(url)).rejects.toThrow('ARTWORK_ORIGIN_REJECTED')
    expect(request).not.toHaveBeenCalled()
  })

  it('refuses without network permission', async () => {
    const { loader, request } = setup(undefined, false)
    await expect(loader.load(COVER)).rejects.toThrow('ARTWORK_PERMISSION_DENIED')
    expect(request).not.toHaveBeenCalled()
  })

  it.each([
    ['a non-200 status', { ...image(), status: 404 }, 'ARTWORK_RESPONSE_REJECTED'],
    ['a non-image type', image(8, 'text/html'), 'ARTWORK_RESPONSE_REJECTED'],
    ['an SVG', image(8, 'image/svg+xml'), 'ARTWORK_RESPONSE_REJECTED'],
    ['a missing type', { status: 200, headers: {}, body: new Uint8Array(8) }, 'ARTWORK_RESPONSE_REJECTED'],
    ['an empty body', image(0), 'ARTWORK_RESPONSE_REJECTED'],
    ['an oversized body', image(2 * 1024 * 1024 + 1), 'ARTWORK_TOO_LARGE'],
  ])('rejects %s with a fixed code and creates no Blob URL', async (_name, response, code) => {
    const { loader } = setup(vi.fn(async () => response))
    const failure = await loader.load(COVER).catch((error: Error) => error)
    expect((failure as Error).message).toBe(code)
    expect(created).toHaveLength(0)
  })

  it('accepts an image type with parameters and any letter case', async () => {
    const { loader } = setup(vi.fn(async () => image(8, 'Image/PNG; charset=binary')))
    await loader.load(COVER)
    expect(created[0].type).toBe('image/png')
  })

  it('does not cache failures and does not leak the URL or SDK details in errors', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error(`failed ${COVER} token=secret`), { code: 'NETWORK_ERROR' }))
      .mockResolvedValueOnce(image())
    const { loader } = setup(request)
    const failure = (await loader.load(COVER).catch((error: Error) => error)) as Error
    expect(failure.message).toBe('ARTWORK_REQUEST_FAILED')
    expect(failure.message).not.toContain('secret')
    await expect(loader.load(COVER)).resolves.toBe('blob:cover-1')
    expect(request).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['TIMEOUT', 'ARTWORK_TIMEOUT'],
    ['PERMISSION_DENIED', 'ARTWORK_PERMISSION_DENIED'],
  ])('maps the SDK error %s to a fixed code', async (sdkCode, code) => {
    const { loader } = setup(vi.fn().mockRejectedValue(Object.assign(new Error('x'), { code: sdkCode })))
    await expect(loader.load(COVER)).rejects.toThrow(code)
  })

  it('runs at most four reads at a time and starts the next as one finishes', async () => {
    const replies = Array.from({ length: 6 }, () => deferred<ReturnType<typeof image>>())
    let call = 0
    const { loader, request } = setup(vi.fn(() => replies[call++].promise))
    const loads = replies.map((_, i) => loader.load(`https://p1.music.126.net/${i}.jpg`))
    await flush()
    expect(request).toHaveBeenCalledTimes(4)
    replies[0].resolve(image())
    await flush()
    expect(request).toHaveBeenCalledTimes(5)
    replies.slice(1).forEach((reply) => reply.resolve(image()))
    await Promise.all(loads)
    expect(request).toHaveBeenCalledTimes(6)
  })

  it('serves the most recent request first when reads are waiting, so the current cover is not stuck behind thumbnails', async () => {
    const replies = Array.from({ length: 7 }, () => deferred<ReturnType<typeof image>>())
    let call = 0
    const { loader, request } = setup(vi.fn(() => replies[call++].promise))
    const loads = [0, 1, 2, 3, 4, 5].map((i) => loader.load(`https://p1.music.126.net/thumb-${i}.jpg`))
    await flush()
    const current = loader.load('https://p1.music.126.net/current.jpg')
    replies[0].resolve(image())
    await flush()
    expect(request.mock.calls[4][1].query.url).toBe('https://p1.music.126.net/current.jpg')
    replies.forEach((reply) => reply.resolve(image()))
    await Promise.all([...loads, current])
  })

  it('cancels an unfinished read when its only caller aborts, and a later caller starts over', async () => {
    const reply = deferred<ReturnType<typeof image>>()
    const request = vi.fn().mockReturnValueOnce(reply.promise).mockResolvedValueOnce(image())
    const { loader } = setup(request)
    const controller = new AbortController()
    const pending = loader.load(COVER, controller.signal)
    await flush()
    const sdkSignal = request.mock.calls[0][1].signal as AbortSignal
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(sdkSignal.aborted).toBe(true)
    await expect(loader.load(COVER)).resolves.toBe('blob:cover-1')
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('keeps a shared read alive while another caller still waits', async () => {
    const reply = deferred<ReturnType<typeof image>>()
    const { loader, request } = setup(vi.fn(() => reply.promise))
    const first = new AbortController()
    const a = loader.load(COVER, first.signal)
    const b = loader.load(COVER)
    await flush()
    first.abort()
    await expect(a).rejects.toMatchObject({ name: 'AbortError' })
    expect((request.mock.calls[0][1].signal as AbortSignal).aborted).toBe(false)
    reply.resolve(image())
    await expect(b).resolves.toBe('blob:cover-1')
  })

  it('never starts a read that was cancelled while queued', async () => {
    const replies = Array.from({ length: 4 }, () => deferred<ReturnType<typeof image>>())
    let call = 0
    const { loader, request } = setup(vi.fn(() => replies[call++].promise))
    const running = replies.map((_, i) => loader.load(`https://p1.music.126.net/${i}.jpg`))
    await flush()
    const controller = new AbortController()
    const queued = loader.load('https://p1.music.126.net/queued.jpg', controller.signal)
    controller.abort()
    await expect(queued).rejects.toMatchObject({ name: 'AbortError' })
    replies.forEach((reply) => reply.resolve(image()))
    await Promise.all(running)
    await flush()
    expect(request).toHaveBeenCalledTimes(4)
  })

  it('rejects immediately for an already aborted signal', async () => {
    const { loader, request } = setup()
    const controller = new AbortController()
    controller.abort()
    await expect(loader.load(COVER, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(request).not.toHaveBeenCalled()
  })

  describe('cache size', () => {
    const TWO_MIB = 2 * 1024 * 1024
    const cover = (n: number) => `https://p1.music.126.net/abc/${n}.jpg`

    it('revokes the least recently used covers once the cached bytes pass the budget', async () => {
      const { loader } = setup(vi.fn(async () => image(TWO_MIB)))
      for (let n = 1; n <= 24; n++) await loader.load(cover(n)) // 48 MiB: exactly at the budget
      expect(revoked).toEqual([])
      await loader.load(cover(25)) // 50 MiB: the oldest goes
      expect(revoked).toEqual(['blob:cover-1'])
    })

    it('counts a repeated request as use, so a cover still on screen outlives older ones', async () => {
      const { loader, request } = setup(vi.fn(async () => image(TWO_MIB)))
      for (let n = 1; n <= 24; n++) await loader.load(cover(n))
      await loader.load(cover(1)) // cache hit: now the most recently used
      expect(request).toHaveBeenCalledTimes(24)
      await loader.load(cover(25))
      expect(revoked).toEqual(['blob:cover-2'])
      // The evicted one is read again on demand; the kept one is still served from the cache.
      await loader.load(cover(2))
      expect(request).toHaveBeenCalledTimes(26)
      await expect(loader.load(cover(1))).resolves.toBe('blob:cover-1')
    })

    it('forgets evicted bytes, so the budget is not exhausted by covers that are already gone', async () => {
      const { loader } = setup(vi.fn(async () => image(TWO_MIB)))
      for (let n = 1; n <= 60; n++) await loader.load(cover(n))
      // 60 × 2 MiB = 120 MiB loaded; at most 24 of them (48 MiB) stay alive.
      expect(revoked).toHaveLength(36)
    })
  })

  it('revokes every Blob URL, aborts in-flight reads and refuses later loads on dispose', async () => {
    const pending = deferred<ReturnType<typeof image>>()
    const request = vi.fn().mockResolvedValueOnce(image()).mockReturnValueOnce(pending.promise)
    const { loader } = setup(request)
    await loader.load(COVER)
    const inFlight = loader.load('https://p2.music.126.net/y.jpg').catch((error: Error) => error)
    await flush()
    loader.dispose()
    expect(revoked).toEqual(['blob:cover-1'])
    expect(((await inFlight) as Error).name).toBe('AbortError')
    expect((request.mock.calls[1][1].signal as AbortSignal).aborted).toBe(true)
    await expect(loader.load(COVER)).rejects.toThrow('ARTWORK_DISPOSED')
  })

  it('does not leak a Blob URL for a read that finishes after dispose', async () => {
    const reply = deferred<ReturnType<typeof image>>()
    const { loader } = setup(vi.fn(() => reply.promise))
    const pending = loader.load(COVER).catch((error: Error) => error)
    await flush()
    loader.dispose()
    reply.resolve(image())
    await pending
    await flush()
    // Either never created, or created and revoked straight away.
    expect(created.length).toBe(revoked.length)
  })
})
