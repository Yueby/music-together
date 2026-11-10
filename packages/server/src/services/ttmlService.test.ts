import { describe, expect, it, vi } from 'vitest'
import { createTtmlService, TTML_MAX_BYTES } from './ttmlService.js'

vi.mock('../utils/logger.js', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }))

const base = 'https://ttml.example.test'
const xml =
  '<?xml version="1.0"?><tt xmlns="http://www.w3.org/ns/ttml" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" itunes:timing="Word">' +
  '<body dur="3s"><div><p itunes:key="L1" begin="00:00.500" end="00:02.500">' +
  '<span begin="00:00.500" end="00:01.500">Hello</span> <span begin="00:01.500" end="00:02.500">world</span></p></div></body></tt>'

const reply = (body: BodyInit | null, init?: ResponseInit) => new Response(body, init)
const words = (lines: unknown) => (lines as { words: { word: string }[] }[])[0].words.map((w) => w.word.trim())

function setup(
  handler: (url: string, init: RequestInit) => Promise<Response> | Response,
  resolve: (hostname: string) => Promise<string[]> = async () => ['93.184.216.34'],
) {
  const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => handler(String(url), init ?? {}))
  const lookup = vi.fn(resolve)
  let time = 1_000
  const service = createTtmlService({
    baseUrl: base,
    fetcher: fetcher as unknown as typeof fetch,
    now: () => time,
    resolve: lookup,
  })
  return { service, fetcher, lookup, advance: (ms: number) => (time += ms) }
}

const found = { ok: true, lines: expect.any(Array) }
const missing = { ok: true, lines: null }
const unavailable = { ok: false }

describe('ttmlService', () => {
  it.each([
    ['netease', '1234', `${base}/ncm-lyrics/1234.ttml`],
    ['tencent', '002abcXYZ', `${base}/qq-lyrics/002abcXYZ.ttml`],
  ] as const)('requests only the fixed library path for %s and returns parsed lines', async (source, id, url) => {
    const { service, fetcher } = setup(() => reply(xml))
    const result = await service.get(source, id)
    expect(result).toEqual(found)
    expect(result.ok && words(result.lines)).toEqual(['Hello', 'world'])
    expect(fetcher).toHaveBeenCalledOnce()
    expect(String(fetcher.mock.calls[0][0])).toBe(url)
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: 'manual', signal: expect.any(AbortSignal) })
  })

  it('returns player lines in the shape the lyric player and the client expect, translation included', async () => {
    const withTranslation =
      '<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" itunes:timing="Word">' +
      '<head><metadata><ttm:agent type="person" xml:id="v1"/></metadata></head><body dur="4:10.610"><div>' +
      '<p begin="0.835" end="6.598" itunes:key="L1" ttm:agent="v1"><span begin="0.835" end="1.401">A</span> <span begin="1.401" end="2.287">lu</span>' +
      '<span ttm:role="x-translation" xml:lang="zh-CN">我的月亮呀</span></p></div></body></tt>'
    const result = await setup(() => reply(withTranslation)).service.get('netease', '1')
    expect(result).toEqual({
      ok: true,
      lines: [
        expect.objectContaining({
          startTime: 835,
          endTime: 6598,
          translatedLyric: '我的月亮呀',
          words: [
            expect.objectContaining({ word: 'A ', startTime: 835, endTime: 1401 }),
            expect.objectContaining({ word: 'lu', startTime: 1401, endTime: 2287 }),
          ],
        }),
      ],
    })
  })

  it('treats a missing file as "no entry" and any other upstream failure as unavailable', async () => {
    expect(await setup(() => reply('nope', { status: 404 })).service.get('netease', '1')).toEqual(missing)
    expect(await setup(() => reply('boom', { status: 500 })).service.get('netease', '1')).toEqual(unavailable)
  })

  it('treats a network failure as unavailable', async () => {
    const failing = setup(() => Promise.reject(new TypeError('fetch failed')))
    expect(await failing.service.get('netease', '1')).toEqual(unavailable)
  })

  it.each([
    ['an HTML page answered with 200', () => reply('<html><body>not found</body></html>')],
    ['well-formed XML that is not TTML', () => reply('<note><to>x</to></note>')],
    ['a TTML without lyric lines', () => reply('<tt xmlns="http://www.w3.org/ns/ttml"><body/></tt>')],
    ['invalid UTF-8', () => reply(new Uint8Array([0x3c, 0x74, 0x74, 0x3e, 0xff, 0xfe]))],
    ['a DTD with entities', () => reply('<?xml version="1.0"?><!DOCTYPE tt [<!ENTITY a "aaaa">]>' + xml)],
    ['a body over the size cap', () => reply('<tt>' + 'x'.repeat(TTML_MAX_BYTES) + '</tt>')],
    [
      'a declared length over the cap',
      () => reply(xml, { headers: { 'content-length': String(TTML_MAX_BYTES + 1) } }),
    ],
  ])('treats %s as no entry', async (_name, answer) => {
    expect(await setup(answer).service.get('netease', '1')).toEqual(missing)
  })

  describe('redirects', () => {
    const redirect = (location: string, status = 302) => reply(null, { status, headers: { location } })

    it('follows the library redirect to a sibling host of the same site', async () => {
      const api = 'https://api.beta.ttml.example.test/api/v1/lyrics/ncm-lyrics/7.ttml'
      const { service, fetcher } = setup((url) => (url === `${base}/ncm-lyrics/7.ttml` ? redirect(api) : reply(xml)))
      expect(await service.get('netease', '7')).toEqual(found)
      expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([`${base}/ncm-lyrics/7.ttml`, api])
    })

    it('resolves relative redirects against the current URL', async () => {
      const { service, fetcher } = setup((url) => (url.endsWith('/7.ttml') ? redirect('/moved/seven.ttml') : reply(xml)))
      expect(await service.get('netease', '7')).toEqual(found)
      expect(String(fetcher.mock.calls[1][0])).toBe(`${base}/moved/seven.ttml`)
    })

    it.each([
      'https://evil.test/7.ttml',
      'https://ttml.example.test.evil.test/7.ttml',
      'http://ttml.example.test/7.ttml',
      'https://127.0.0.1/7.ttml',
      'https://[::1]/7.ttml',
      'https://user:pass@ttml.example.test/7.ttml',
      'https://ttml.example.test:8443/7.ttml',
    ])('refuses to follow a redirect to %s', async (location) => {
      const { service, fetcher } = setup((url) => (url === `${base}/ncm-lyrics/7.ttml` ? redirect(location) : reply(xml)))
      expect(await service.get('netease', '7')).toEqual(unavailable)
      expect(fetcher).toHaveBeenCalledOnce()
    })

    it('gives up on a redirect loop and on a redirect without a location', async () => {
      const loop = setup(() => redirect(`${base}/loop.ttml`))
      expect(await loop.service.get('netease', '7')).toEqual(unavailable)
      expect(loop.fetcher).toHaveBeenCalledTimes(4)
      const bare = setup(() => reply(null, { status: 302 }))
      expect(await bare.service.get('netease', '8')).toEqual(unavailable)
    })

    it('maps a missing file behind the redirect to "no entry"', async () => {
      const { service } = setup((url) =>
        url.startsWith(base) ? redirect('https://api.ttml.example.test/x') : reply('lyric not found', { status: 404 }),
      )
      expect(await service.get('netease', '7')).toEqual(missing)
    })
  })

  describe('network safety', () => {
    it.each(['127.0.0.1', '10.0.0.5', '169.254.169.254', '::1', 'fd00::1'])(
      'does not contact a host that resolves to %s',
      async (address) => {
        const { service, fetcher } = setup(() => reply(xml), async () => [address])
        expect(await service.get('netease', '1')).toEqual(unavailable)
        expect(fetcher).not.toHaveBeenCalled()
      },
    )

    it('rejects a host with any non-public address, or none at all', async () => {
      expect(await setup(() => reply(xml), async () => ['93.184.216.34', '10.0.0.1']).service.get('netease', '1')).toEqual(
        unavailable,
      )
      expect(await setup(() => reply(xml), async () => []).service.get('netease', '1')).toEqual(unavailable)
    })

    it('checks the redirect target too', async () => {
      const { service, fetcher } = setup(
        (url) => (url.startsWith(base) ? reply(null, { status: 302, headers: { location: 'https://api.ttml.example.test/x' } }) : reply(xml)),
        async (hostname) => (hostname === 'api.ttml.example.test' ? ['10.1.2.3'] : ['93.184.216.34']),
      )
      expect(await service.get('netease', '1')).toEqual(unavailable)
      expect(fetcher).toHaveBeenCalledOnce()
    })
  })

  it('caches hits and misses for a while, and failures only briefly', async () => {
    const hit = setup(() => reply(xml))
    await hit.service.get('netease', '1')
    await hit.service.get('netease', '1')
    expect(hit.fetcher).toHaveBeenCalledOnce()
    hit.advance(7 * 60 * 60_000)
    await hit.service.get('netease', '1')
    expect(hit.fetcher).toHaveBeenCalledTimes(2)

    const none = setup(() => reply('', { status: 404 }))
    await none.service.get('netease', '2')
    await none.service.get('netease', '2')
    expect(none.fetcher).toHaveBeenCalledOnce()
    none.advance(11 * 60_000)
    await none.service.get('netease', '2')
    expect(none.fetcher).toHaveBeenCalledTimes(2)

    const flaky = setup(() => reply('', { status: 503 }))
    await flaky.service.get('netease', '3')
    flaky.advance(20_000)
    await flaky.service.get('netease', '3')
    expect(flaky.fetcher).toHaveBeenCalledOnce()
    flaky.advance(11_000)
    await flaky.service.get('netease', '3')
    expect(flaky.fetcher).toHaveBeenCalledTimes(2)
  })

  it('shares one upstream request between concurrent callers of the same song', async () => {
    const { service, fetcher } = setup(() => reply(xml))
    const results = await Promise.all([service.get('netease', '9'), service.get('netease', '9')])
    expect(results[0]).toEqual(found)
    expect(results[1]).toBe(results[0])
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('keys the cache by source as well as id', async () => {
    const { service, fetcher } = setup(() => reply(xml))
    await service.get('netease', '5')
    await service.get('tencent', '5')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
