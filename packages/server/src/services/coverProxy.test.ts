import { describe, expect, it, vi } from 'vitest'
import { MAPP_COVER_MAX_BYTES } from '@music-together/shared'
import {
  ALLOWED_COVER_HOSTS,
  MAX_WEB_COVER_BYTES,
  fetchCoverImage,
  fetchPlatformCover,
  limitCoverSize,
} from './coverProxy.js'

const url = 'https://p1.music.126.net/cover.jpg'
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47])

function image(body: BodyInit | null = png, headers: Record<string, string> = { 'content-type': 'image/png' }) {
  return new Response(body, { headers })
}
const fetcher = (response: Response) => vi.fn<typeof fetch>().mockResolvedValue(response)

describe('fetchCoverImage', () => {
  it.each(ALLOWED_COVER_HOSTS)('fetches an image from allowed host %s', async (host) => {
    const fetch = fetcher(image())
    await expect(fetchCoverImage(`https://${host}/a.png`, undefined, fetch)).resolves.toEqual({
      ok: true,
      contentType: 'image/png',
      body: png,
    })
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      `https://${host}/a.png`,
      expect.objectContaining({ headers: { 'User-Agent': 'Mozilla/5.0' }, signal: expect.any(AbortSignal) }),
    )
  })

  it.each(['https://evil.test/a.png', 'https://p1.music.126.net.evil.test/a.png', 'https://music.126.net/a.png'])(
    'never contacts a host outside the allowlist: %s',
    async (target) => {
      const fetch = fetcher(image())
      await expect(fetchCoverImage(target, undefined, fetch)).resolves.toEqual({
        ok: false,
        status: 403,
        error: 'Host not allowed',
      })
      expect(fetch).not.toHaveBeenCalled()
    },
  )

  it('lets an invalid URL or a network failure propagate for the caller to map', async () => {
    await expect(fetchCoverImage('not a url', undefined, fetcher(image()))).rejects.toThrow()
    const failing = vi.fn<typeof fetch>().mockRejectedValue(new Error('network down'))
    await expect(fetchCoverImage(url, undefined, failing)).rejects.toThrow('network down')
  })

  it('passes an upstream error status through', async () => {
    await expect(fetchCoverImage(url, undefined, fetcher(new Response('nope', { status: 404 })))).resolves.toEqual({
      ok: false,
      status: 404,
      error: 'Upstream fetch failed',
    })
  })

  describe('redirects', () => {
    const redirect = (location: string) => new Response(null, { status: 302, headers: { location } })

    it('follows a redirect that stays on the allowlist over https', async () => {
      const fetch = vi.fn<typeof fetch>().mockResolvedValueOnce(redirect('https://p2.music.126.net/b.jpg'))
      fetch.mockResolvedValueOnce(image())
      await expect(fetchCoverImage(url, undefined, fetch)).resolves.toMatchObject({ ok: true })
      expect(fetch.mock.calls.map(([target]) => String(target))).toEqual([url, 'https://p2.music.126.net/b.jpg'])
      expect(fetch.mock.calls[0][1]).toMatchObject({ redirect: 'manual' })
    })

    it.each([
      'https://evil.test/a.jpg',
      'http://p2.music.126.net/a.jpg',
      'https://127.0.0.1/a.jpg',
      'https://p2.music.126.net.evil.test/a.jpg',
    ])('refuses a redirect to %s without contacting it', async (location) => {
      const fetch = vi.fn<typeof fetch>().mockResolvedValue(redirect(location))
      await expect(fetchCoverImage(url, undefined, fetch)).resolves.toEqual({
        ok: false,
        status: 403,
        error: 'Host not allowed',
      })
      expect(fetch).toHaveBeenCalledOnce()
    })

    it('gives up on a redirect loop and on a redirect without a location', async () => {
      const loop = vi.fn<typeof fetch>().mockImplementation(async () => redirect(url))
      await expect(fetchCoverImage(url, undefined, loop)).resolves.toMatchObject({ ok: false })
      expect(loop).toHaveBeenCalledTimes(4)
      const bare = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 302 }))
      await expect(fetchCoverImage(url, undefined, bare)).resolves.toMatchObject({ ok: false, status: 403 })
    })
  })

  it.each([{ 'content-type': 'text/html' }, {}])('rejects a non-image response %#', async (headers) => {
    await expect(fetchCoverImage(url, undefined, fetcher(image('<html>', headers)))).resolves.toEqual({
      ok: false,
      status: 413,
      error: 'Invalid or oversized image',
    })
  })

  it('rejects a declared length above the limit before reading the body', async () => {
    const response = image(png, { 'content-type': 'image/png', 'content-length': String(MAX_WEB_COVER_BYTES + 1) })
    await expect(fetchCoverImage(url, undefined, fetcher(response))).resolves.toMatchObject({ ok: false, status: 413 })
    const small = image(png, { 'content-type': 'image/png', 'content-length': '5' })
    await expect(fetchCoverImage(url, 4, fetcher(small))).resolves.toMatchObject({ ok: false, status: 413 })
  })

  it('stops reading and cancels the upstream body once an undeclared body passes the limit', async () => {
    const cancel = vi.fn()
    let sent = 0
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent++
        controller.enqueue(new Uint8Array(4))
      },
      cancel,
    })
    await expect(fetchCoverImage(url, 10, fetcher(image(body)))).resolves.toEqual({
      ok: false,
      status: 413,
      error: 'Image too large',
    })
    expect(cancel).toHaveBeenCalledOnce()
    expect(sent).toBeLessThan(10)
  })

  it('accepts a body exactly at the limit and an empty body', async () => {
    await expect(fetchCoverImage(url, png.length, fetcher(image()))).resolves.toMatchObject({ ok: true })
    await expect(fetchCoverImage(url, 10, fetcher(image(null)))).resolves.toMatchObject({
      ok: true,
      body: Buffer.alloc(0),
    })
  })
})

describe('limitCoverSize', () => {
  it.each(['p1', 'p2', 'p3', 'p4'])('asks NetEase %s for a player-sized image instead of the original', (host) => {
    expect(limitCoverSize(`https://${host}.music.126.net/abc==/123.jpg`)).toBe(
      `https://${host}.music.126.net/abc==/123.jpg?param=600y600`,
    )
  })

  it('keeps a size the caller already chose, such as list thumbnails', () => {
    const thumbnail = 'https://p3.music.126.net/abc==/123.jpg?param=120y120'
    expect(limitCoverSize(thumbnail)).toBe(thumbnail)
  })

  it('keeps other query parameters when adding the size', () => {
    expect(limitCoverSize('https://p1.music.126.net/a.jpg?x=1')).toBe(
      'https://p1.music.126.net/a.jpg?x=1&param=600y600',
    )
  })

  it.each(['https://y.gtimg.cn/music/photo_new/T002R300x300M000x.jpg', 'https://imgessl.kugou.com/a.jpg', 'not a url'])(
    'leaves %s untouched',
    (target) => {
      expect(limitCoverSize(target)).toBe(target)
    },
  )
})

describe('fetchPlatformCover', () => {
  it('requests the size-limited URL and enforces the platform byte cap', async () => {
    const fetch = fetcher(image())
    await expect(fetchPlatformCover('https://p3.music.126.net/abc==/1.jpg', fetch)).resolves.toMatchObject({
      ok: true,
      contentType: 'image/png',
    })
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      'https://p3.music.126.net/abc==/1.jpg?param=600y600',
      expect.anything(),
    )

    const big = fetcher(image(Buffer.alloc(MAPP_COVER_MAX_BYTES + 1)))
    await expect(fetchPlatformCover('https://p3.music.126.net/abc==/1.jpg', big)).resolves.toMatchObject({
      ok: false,
      status: 413,
    })
  })

  it('still refuses hosts outside the allowlist without contacting them', async () => {
    const fetch = fetcher(image())
    await expect(fetchPlatformCover('https://evil.test/a.png', fetch)).resolves.toMatchObject({
      ok: false,
      status: 403,
    })
    expect(fetch).not.toHaveBeenCalled()
  })
})
