import { describe, expect, it, vi } from 'vitest'
import { ALLOWED_COVER_HOSTS, MAX_WEB_COVER_BYTES, fetchCoverImage } from './coverProxy.js'

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
