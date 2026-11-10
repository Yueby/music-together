import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { lookup } from 'node:dns'
import { request } from 'node:https'
import type { ClientRequest, IncomingMessage } from 'node:http'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isPublicMediaAddress, MAX_MEDIA_BYTES, requestMediaSource, validateMediaUrl } from './mediaSourceRequest.js'

vi.mock('node:dns', () => ({ lookup: vi.fn() }))
vi.mock('node:https', () => ({ request: vi.fn() }))
afterEach(() => {
  vi.useRealTimers()
  vi.resetAllMocks()
})

const url = 'https://m1.music.126.net/signed?fixture=secret'

/** Fake https.request: calls the response callback once `end()` is called. */
function transport(status = 200, headers: Record<string, string> = { 'content-type': 'audio/mpeg' }, answers = true) {
  const body = Object.assign(new PassThrough(), { statusCode: status, headers }) as unknown as IncomingMessage
  const req = Object.assign(new EventEmitter(), { destroy: vi.fn(), end: vi.fn() })
  vi.mocked(request).mockImplementation((...args: unknown[]) => {
    const respond = args[2] as (body: IncomingMessage) => void
    if (answers) req.end.mockImplementation(() => queueMicrotask(() => respond(body)))
    return req as unknown as ClientRequest
  })
  return { body, req }
}

describe('media source URL and address boundary', () => {
  it.each([
    '0.0.0.0',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.0.1',
    '198.18.0.1',
    '224.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    '::ffff:127.0.0.1',
    '::ffff:8.8.8.8',
    'fe80::1',
    'fc00::1',
    'ff02::1',
    '64:ff9b::808:808',
    '2001::1',
    '2001:db8::1',
    '2002:0808:0808::1',
    '2001:4860::1%eth0',
    'garbage',
  ])('rejects special-use address %s', (ip) => expect(isPublicMediaAddress(ip)).toBe(false))

  it.each(['8.8.8.8', '1.1.1.1', '93.184.216.34', '2001:4860:4860::8888', '2606:4700:4700::1111'])(
    'accepts public %s',
    (ip) => expect(isPublicMediaAddress(ip)).toBe(true),
  )

  it.each([
    'http://m1.music.126.net/a',
    'https://user:pass@m1.music.126.net/a',
    url + '#x',
    'https://m1.music.126.net:444/a',
    'https://127.0.0.1/a',
    'https://music.126.net/a',
    'https://m1.music.126.net.evil.test/a',
    'https://evil.qq.com/a',
    'https://dl.stream.qqmusic.qq.com/a',
    'https://unknown-cdn.test/a',
    'https://evil.test\\@m1.music.126.net/a',
  ])('rejects unapproved netease target %#', (raw) =>
    expect(() => validateMediaUrl('netease', raw)).toThrow('MEDIA_SOURCE_REJECTED'),
  )

  it('decides on the parsed host, so userinfo/backslash tricks cannot redirect the connection', () => {
    // The request connects to the parsed URL's host, which here is still the approved CDN.
    expect(validateMediaUrl('netease', 'https://m1.music.126.net\\@evil.test/a').hostname).toBe('m1.music.126.net')
  })

  it('keeps allowlists source-specific and narrow', () => {
    expect(validateMediaUrl('netease', url).hostname).toBe('m1.music.126.net')
    expect(validateMediaUrl('tencent', 'https://dl.stream.qqmusic.qq.com/a').hostname).toBe('dl.stream.qqmusic.qq.com')
    expect(validateMediaUrl('tencent', 'https://ws.music.tc.qq.com/a').hostname).toBe('ws.music.tc.qq.com')
    // The host QQ's vkey URLs point at in production.
    expect(validateMediaUrl('tencent', 'https://aqqmusic.tc.qq.com/M500abc.mp3?vkey=x').hostname).toBe('aqqmusic.tc.qq.com')
    expect(() => validateMediaUrl('tencent', 'https://tc.qq.com.evil.test/a')).toThrow()
    expect(() => validateMediaUrl('tencent', 'https://evil.test/.tc.qq.com')).toThrow()
    expect(() => validateMediaUrl('netease', 'https://aqqmusic.tc.qq.com/a')).toThrow()
    expect(validateMediaUrl('kugou', 'https://fs.kugou.com/a').hostname).toBe('fs.kugou.com')
    expect(() => validateMediaUrl('tencent', 'https://music.qq.com/a')).toThrow()
  })
})

describe('single checked TLS connection', () => {
  it('sends a minimal request and pins a validated DNS answer into the socket lookup', async () => {
    const { body } = transport()
    const signal = new AbortController().signal
    const result = await requestMediaSource('netease', url, signal)
    expect(result.body).toBe(body)
    const options = vi.mocked(request).mock.calls[0][1] as Record<string, any>
    expect(options).toMatchObject({
      agent: false,
      method: 'GET',
      signal,
      headers: { Accept: 'audio/*, application/ogg, application/octet-stream', 'Accept-Encoding': 'identity' },
    })
    // Default TLS validation, no extra (cookie/auth) headers.
    expect(options.rejectUnauthorized).toBeUndefined()
    expect(Object.keys(options.headers)).toEqual(['Accept', 'Accept-Encoding'])

    vi.mocked(lookup).mockImplementation(((_host: string, _options: unknown, cb: Function) =>
      cb(null, [
        { address: '2001:4860::8888', family: 6 },
        { address: '8.8.8.8', family: 4 },
      ])) as typeof lookup)
    const callback = vi.fn()
    options.lookup('m1.music.126.net', { all: true }, callback)
    expect(callback).toHaveBeenLastCalledWith(null, [{ address: '2001:4860::8888', family: 6 }])
    options.lookup('m1.music.126.net', { family: 4 }, callback)
    expect(callback).toHaveBeenLastCalledWith(null, '8.8.8.8', 4)
    expect(lookup).toHaveBeenCalledWith('m1.music.126.net', { all: true, verbatim: true }, expect.any(Function))
    body.destroy()
  })

  it.each([
    ['public', [{ address: '8.8.8.8', family: 4 }], true],
    ['private', [{ address: '127.0.0.1', family: 4 }], false],
    [
      'mixed public/private',
      [
        { address: '8.8.8.8', family: 4 },
        { address: '::ffff:127.0.0.1', family: 6 },
      ],
      false,
    ],
    ['empty', [], false],
  ])('checks every connection against rebinding: %s DNS answer', async (_name, records, allowed) => {
    const { body } = transport()
    await requestMediaSource('netease', url, new AbortController().signal)
    const options = vi.mocked(request).mock.calls.at(-1)![1] as Record<string, any>
    vi.mocked(lookup).mockImplementation(((_host: string, _options: unknown, cb: Function) =>
      cb(null, records)) as typeof lookup)
    const cb = vi.fn()
    options.lookup('m1.music.126.net', { all: true }, cb)
    expect(cb.mock.calls[0][0] === null).toBe(allowed)
    body.destroy()
  })

  it.each([
    [401, {}, 'MEDIA_SOURCE_DENIED'],
    [403, {}, 'MEDIA_SOURCE_DENIED'],
    [302, { location: 'https://127.0.0.1/secret' }, 'MEDIA_SOURCE_REJECTED'],
    [206, { 'content-range': 'bytes 0-15/16', 'content-length': '16' }, 'MEDIA_SOURCE_REJECTED'],
    [200, { 'content-type': 'text/html' }, 'MEDIA_TYPE_REJECTED'],
    [200, { 'content-type': 'application/json' }, 'MEDIA_TYPE_REJECTED'],
    [200, { 'content-encoding': 'gzip' }, 'MEDIA_ENCODING_REJECTED'],
    [200, { 'content-length': String(MAX_MEDIA_BYTES + 1) }, 'MEDIA_TOO_LARGE'],
    [200, { 'content-length': '0' }, 'MEDIA_TOO_LARGE'],
    [200, { 'content-length': 'NaN' }, 'MEDIA_LENGTH_REJECTED'],
  ])('rejects upstream response %# without retrying or following redirects', async (status, headers, code) => {
    const { body, req } = transport(status as number, { 'content-type': 'audio/mpeg', ...headers })
    await expect(requestMediaSource('netease', url, new AbortController().signal)).rejects.toMatchObject({ code })
    expect(request).toHaveBeenCalledTimes(1)
    expect(body.destroyed).toBe(true)
    expect(req.destroy).toHaveBeenCalled()
  })

  it('accepts a plain 200 audio response with identity encoding and a bounded length', async () => {
    const { body } = transport(200, {
      'content-type': 'audio/flac; charset=binary',
      'content-encoding': 'identity',
      'content-length': '16',
    })
    await expect(requestMediaSource('netease', url, new AbortController().signal)).resolves.toMatchObject({
      length: 16,
      contentType: 'audio/flac',
    })
    body.destroy()
  })

  it('bounds DNS/connect/header wait to 8s and clears the timer', async () => {
    vi.useFakeTimers()
    const { req } = transport(200, undefined, false)
    const rejected = expect(requestMediaSource('netease', url, new AbortController().signal)).rejects.toMatchObject({
      code: 'MEDIA_SOURCE_TIMEOUT',
    })
    await vi.advanceTimersByTimeAsync(8000)
    await rejected
    expect(req.destroy).toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('reports cancellation and sanitizes transport errors', async () => {
    const aborted = new AbortController()
    const first = transport(200, undefined, false)
    const cancelled = requestMediaSource('netease', url, aborted.signal)
    aborted.abort()
    first.req.emit('error', new Error('AbortError https://secret'))
    await expect(cancelled).rejects.toMatchObject({ code: 'MEDIA_ABORTED', status: 499 })

    const second = transport(200, undefined, false)
    const failed = requestMediaSource('netease', url, new AbortController().signal)
    second.req.emit('error', new Error('connect ECONNREFUSED https://secret'))
    await expect(failed).rejects.toMatchObject({ code: 'MEDIA_SOURCE_REJECTED', message: 'MEDIA_SOURCE_REJECTED' })
  })

  it('rejects before any request when the URL is not approved', async () => {
    await expect(
      requestMediaSource('netease', 'https://evil.test/a', new AbortController().signal),
    ).rejects.toMatchObject({ code: 'MEDIA_SOURCE_REJECTED' })
    expect(request).not.toHaveBeenCalled()
  })
})
