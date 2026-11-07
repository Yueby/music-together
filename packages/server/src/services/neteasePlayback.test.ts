import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  songUrl: vi.fn(),
  writeFile: vi.fn(),
  rename: vi.fn(),
  unlink: vi.fn(),
  readFile: vi.fn(),
  warn: vi.fn(),
  fetch: vi.fn(),
}))
vi.mock('@neteasecloudmusicapienhanced/api', () => ({
  default: { register_xeapikey: mocks.register, song_url_v1: mocks.songUrl },
}))
vi.mock('node:fs/promises', () => ({
  writeFile: mocks.writeFile,
  rename: mocks.rename,
  unlink: mocks.unlink,
  readFile: mocks.readFile,
}))
vi.mock('../utils/logger.js', () => ({ logger: { warn: mocks.warn } }))

const NOW = Date.parse('2026-07-20T00:00:00Z')
const URL = 'https://m801.music.126.net/20260720090000/signature/ymusic/fixture.mp3?token=a%2Bb&x=1'
const COOKIE = 'fixture-private-cookie'
const AUDIO = Uint8Array.from([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
const key = () => ({
  publicKey: Buffer.alloc(32, 7).toString('base64'),
  version: 'v1',
  nextUpdateTime: NOW + 3_600_000,
})
const song = () => ({ id: 110, code: 200, freeTrialInfo: null, url: URL })
const result = (entry: unknown = song()) => ({ status: 200, body: { code: 200, data: [entry] } })
let getUrl: typeof import('./neteasePlayback.js').getNeteasePlaybackUrl

function audioResponse(bytes = AUDIO, status = 206, contentType = 'audio/mpeg') {
  const cancel = vi.fn()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
    },
    cancel,
  })
  return { response: new Response(stream, { status, headers: { 'content-type': contentType } }), cancel }
}

beforeEach(async () => {
  vi.resetModules()
  vi.resetAllMocks()
  vi.spyOn(Date, 'now').mockReturnValue(NOW)
  mocks.register.mockResolvedValue({ status: 200, body: key() })
  mocks.songUrl.mockImplementation(async () => result())
  mocks.writeFile.mockResolvedValue(undefined)
  mocks.rename.mockResolvedValue(undefined)
  mocks.unlink.mockResolvedValue(undefined)
  mocks.fetch.mockImplementation(async () => audioResponse().response)
  vi.stubGlobal('fetch', mocks.fetch)
  getUrl = (await import('./neteasePlayback.js')).getNeteasePlaybackUrl
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('NetEase verified public key initialization', () => {
  it('accepts a normally registered key without sk and writes only validated state atomically', async () => {
    await expect(getUrl('110', 320, COOKIE)).resolves.toBe(URL)
    expect(mocks.register).toHaveBeenCalledExactlyOnceWith({ timeout: 8_000 })
    const [temporaryPath, payload, options] = mocks.writeFile.mock.calls[0]!
    expect(temporaryPath).toMatch(/xeapi_public_key\.[0-9a-f-]+\.tmp$/)
    expect(JSON.parse(payload)).toEqual(key())
    expect(options).toEqual({ encoding: 'utf8', mode: 0o600, flag: 'wx' })
    expect(mocks.rename).toHaveBeenCalledExactlyOnceWith(temporaryPath, join(tmpdir(), 'xeapi_public_key'))
    expect(mocks.unlink).toHaveBeenCalledWith(temporaryPath)
    expect(mocks.writeFile.mock.invocationCallOrder[0]).toBeLessThan(mocks.rename.mock.invocationCallOrder[0]!)
    expect(mocks.readFile).not.toHaveBeenCalled()
  })

  it('preserves an optional string sk while omitting unrelated registration fields', async () => {
    mocks.register.mockResolvedValue({ status: 200, body: { ...key(), sk: 'fixture-sk', deviceId: 'unused' } })
    await expect(getUrl('110', 320, COOKIE)).resolves.toBe(URL)
    expect(JSON.parse(mocks.writeFile.mock.calls[0]![1])).toEqual({ ...key(), sk: 'fixture-sk' })
  })

  it.each([
    { publicKey: 'invalid' },
    { publicKey: Buffer.alloc(31).toString('base64') },
    { publicKey: Buffer.alloc(33).toString('base64') },
    { publicKey: Buffer.alloc(32).toString('base64').replace(/=$/, '!') },
    { version: '' },
    { version: 'v1|injected' },
    { version: 1 },
    { nextUpdateTime: NOW },
    { nextUpdateTime: NOW - 1 },
    { nextUpdateTime: Number.NaN },
    { nextUpdateTime: '1784509200000' },
    { sk: null },
    { sk: {} },
    { sk: undefined },
  ])('rejects invalid or expired public key fields %j', async (fields) => {
    mocks.register.mockResolvedValue({ status: 200, body: { ...key(), ...fields } })
    await expect(getUrl('110', 320, COOKIE)).resolves.toBeNull()
    expect(mocks.writeFile).not.toHaveBeenCalled()
    expect(mocks.songUrl).not.toHaveBeenCalled()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it.each([null, { status: 500, body: key() }, { status: 200, body: null }])(
    'fails closed for a failed or malformed registration response',
    async (response) => {
      mocks.register.mockResolvedValue(response)
      await expect(getUrl('110', 320, COOKIE)).resolves.toBeNull()
      expect(mocks.songUrl).not.toHaveBeenCalled()
    },
  )

  it('registers a fresh key after the SDK reports a missing or unreadable cache', async () => {
    mocks.songUrl.mockRejectedValueOnce(new Error('xeapi public key is missing'))
    await expect(getUrl('110', 320, COOKIE)).resolves.toBeNull()
    await expect(getUrl('110', 320, COOKIE)).resolves.toBe(URL)
    expect(mocks.register).toHaveBeenCalledTimes(2)
  })

  it('shares in-flight initialization across concurrent playback requests', async () => {
    let resolve!: (value: unknown) => void
    mocks.register.mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    const requests = [getUrl('110', 320, COOKIE), getUrl('110', 320, COOKIE), getUrl('110', 320, COOKIE)]
    expect(mocks.register).toHaveBeenCalledTimes(1)
    expect(mocks.songUrl).not.toHaveBeenCalled()
    resolve({ status: 200, body: key() })
    await expect(Promise.all(requests)).resolves.toEqual([URL, URL, URL])
    expect(mocks.writeFile).toHaveBeenCalledTimes(1)
    expect(mocks.songUrl).toHaveBeenCalledTimes(3)
  })

  it('retries after initialization failure and never logs the error or Cookie', async () => {
    mocks.register.mockRejectedValueOnce(new Error(`${COOKIE} ${URL}`))
    await expect(getUrl('110', 320, COOKIE)).resolves.toBeNull()
    await expect(getUrl('110', 320, COOKIE)).resolves.toBe(URL)
    expect(mocks.register).toHaveBeenCalledTimes(2)
    expect(mocks.warn).toHaveBeenCalledExactlyOnceWith('netease_playback_failed')
  })

  it.each(['writeFile', 'rename'] as const)('fails closed on %s failure, cleans up and retries', async (operation) => {
    mocks[operation].mockRejectedValueOnce(new Error('cache unavailable'))
    await expect(getUrl('110', 320, COOKIE)).resolves.toBeNull()
    expect(mocks.songUrl).not.toHaveBeenCalled()
    expect(mocks.unlink).toHaveBeenCalledTimes(1)
    await expect(getUrl('110', 320, COOKIE)).resolves.toBe(URL)
    expect(mocks.register).toHaveBeenCalledTimes(2)
  })

  it('refreshes before nextUpdateTime and blocks playback until an atomic key rotation completes', async () => {
    await expect(getUrl('110', 320, COOKIE)).resolves.toBe(URL)
    await expect(getUrl('110', 320, COOKIE)).resolves.toBe(URL)
    expect(mocks.register).toHaveBeenCalledTimes(1)
    vi.mocked(Date.now).mockReturnValue(NOW + 3_540_001)
    const rotatedKey = { ...key(), version: 'v2', nextUpdateTime: NOW + 7_200_000 }
    mocks.register.mockResolvedValue({ status: 200, body: rotatedKey })
    await expect(getUrl('110', 320, COOKIE)).resolves.toBe(URL)
    expect(mocks.register).toHaveBeenCalledTimes(2)
    expect(JSON.parse(mocks.writeFile.mock.calls[1]![1])).toEqual(rotatedKey)
  })

  it('does not fall back to stale key state when refresh fails, and can retry', async () => {
    await getUrl('110', 320, COOKIE)
    vi.mocked(Date.now).mockReturnValue(NOW + 3_540_001)
    mocks.register.mockRejectedValueOnce(new Error('refresh unavailable'))
    await expect(getUrl('110', 320, COOKIE)).resolves.toBeNull()
    expect(mocks.songUrl).toHaveBeenCalledTimes(1)
    mocks.register.mockResolvedValue({ status: 200, body: { ...key(), nextUpdateTime: NOW + 7_200_000 } })
    await expect(getUrl('110', 320, COOKIE)).resolves.toBe(URL)
    expect(mocks.register).toHaveBeenCalledTimes(3)
  })

  it('rejects keys that expire while the cache write is in progress', async () => {
    mocks.rename.mockImplementation(async () => {
      vi.mocked(Date.now).mockReturnValue(NOW + 3_600_001)
    })
    await expect(getUrl('110', 320, COOKIE)).resolves.toBeNull()
    expect(mocks.songUrl).not.toHaveBeenCalled()
  })
})

describe('NetEase normal authenticated playback endpoint', () => {
  it.each([
    [128, 'standard'],
    [192, 'exhigh'],
    [320, 'exhigh'],
    [999, 'lossless'],
  ])('maps quality %s to %s without request overrides', async (quality, level) => {
    await expect(getUrl('110', quality as number, COOKIE)).resolves.toBe(URL)
    expect(mocks.songUrl).toHaveBeenCalledExactlyOnceWith({
      id: '110',
      level,
      cookie: COOKIE,
      timeout: 8_000,
      randomCNIP: false,
    })
  })

  it.each([
    [256, '110', COOKIE],
    [320, 'invalid-id', COOKIE],
    [320, '110', ''],
  ])('rejects unsupported quality or missing input before registration', async (quality, id, cookie) => {
    await expect(getUrl(id as string, quality as number, cookie as string)).resolves.toBeNull()
    expect(mocks.register).not.toHaveBeenCalled()
  })

  it.each([
    null,
    { status: 403, body: { code: 200, data: [song()] } },
    { status: 200, body: { code: 500, data: [song()] } },
    { status: 200, body: { code: 200, data: null } },
    result(null),
    result({ ...song(), code: 404 }),
    result({ ...song(), id: 111 }),
    result({ ...song(), freeTrialInfo: { start: 0, end: 30_000 } }),
    result({ ...song(), freeTrialInfo: 'null' }),
    result({ ...song(), freeTrialInfo: undefined }),
    result({ ...song(), url: null }),
  ])('rejects failed business codes, mismatched tracks, trials and malformed data', async (response) => {
    mocks.songUrl.mockResolvedValue(response)
    await expect(getUrl('110', 320, COOKIE)).resolves.toBeNull()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it.each([
    'https://evil.test/song.mp3',
    'https://music.126.net.evil.test/song.mp3',
    'https://notmusic.126.net/song.mp3',
    'https://music.126.net/song.mp3',
    'https://127.0.0.1/song.mp3',
    'https://m801.music.126.net@127.0.0.1/song.mp3',
    'https://user:password@m801.music.126.net/song.mp3',
    'https://m801.music.126.net:8443/song.mp3',
    'http://m801.music.126.net:80/song.mp3',
    'ftp://m801.music.126.net/song.mp3',
    '//m801.music.126.net/song.mp3',
    'https://m801.music.126.net/song.mp3#fragment',
    'https://m801.music.126.net\\@evil.test/song.mp3',
  ])('rejects an unsafe CDN URL before any fetch: %s', async (url) => {
    mocks.songUrl.mockResolvedValue(result({ ...song(), url }))
    await expect(getUrl('110', 320, COOKIE)).resolves.toBeNull()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('upgrades HTTP only, preserving the original signed path and query', async () => {
    mocks.songUrl.mockResolvedValue(result({ ...song(), url: URL.replace('https:', 'http:') }))
    await expect(getUrl('110', 320, COOKIE)).resolves.toBe(URL)
    expect(mocks.fetch).toHaveBeenCalledWith(URL, expect.anything())
  })

  it('rejects expired URLs without probing the CDN', async () => {
    mocks.songUrl.mockResolvedValue(result({ ...song(), url: URL.replace('20260720090000', '20260720080030') }))
    await expect(getUrl('110', 320, COOKIE)).resolves.toBeNull()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('rechecks expiry after the CDN probe before returning', async () => {
    mocks.fetch.mockImplementation(async () => {
      vi.mocked(Date.now).mockReturnValue(NOW + 3_570_000)
      return audioResponse().response
    })
    await expect(getUrl('110', 320, COOKIE)).resolves.toBeNull()
  })

  it('returns null for SDK rejection and logs only a fixed event', async () => {
    mocks.songUrl.mockRejectedValue(new Error(`${COOKIE} ${URL}`))
    await expect(getUrl('110', 320, COOKIE)).resolves.toBeNull()
    expect(mocks.warn).toHaveBeenCalledExactlyOnceWith('netease_playback_failed')
  })
})

describe('bounded CDN audio verification', () => {
  it.each([200, 206])('allows HTTP %s audio and aborts/cancels the stream promptly', async (status) => {
    const { response, cancel } = audioResponse(AUDIO, status)
    mocks.fetch.mockResolvedValue(response)
    await expect(getUrl('110', 320, COOKIE)).resolves.toBe(URL)
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith(URL, {
      method: 'GET',
      headers: { Range: 'bytes=0-4095' },
      redirect: 'manual',
      signal: expect.any(AbortSignal),
    })
    expect(mocks.fetch.mock.calls[0]![1].signal.aborted).toBe(true)
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it.each([
    Buffer.from([0xff, 0xfb, 0x90, 0x64, ...Array(12).fill(0)]),
    Buffer.from('fLaCfixture-audio-data'),
    Buffer.from('OggSfixture-audio-data'),
    Buffer.from([0, 0, 0, 24, ...Buffer.from('ftypM4A fixture-audio-data')]),
    Buffer.from('RIFF0000WAVEfixture-audio-data'),
  ])('accepts a recognizable audio container header', async (header) => {
    mocks.fetch.mockResolvedValue(audioResponse(header).response)
    await expect(getUrl('110', 320, COOKIE)).resolves.toBe(URL)
  })

  it.each([403, 404, 500, 302, 307])(
    'rejects status %s without following redirects and cancels the body',
    async (status) => {
      const { response, cancel } = audioResponse(AUDIO, status)
      mocks.fetch.mockResolvedValue(response)
      await expect(getUrl('110', 320, COOKIE)).resolves.toBeNull()
      expect(cancel).toHaveBeenCalledTimes(1)
      expect(mocks.fetch).toHaveBeenCalledTimes(1)
    },
  )

  it.each(['text/html', 'application/xhtml+xml', 'application/json'])(
    'rejects %s even when the bytes resemble audio',
    async (type) => {
      const { response, cancel } = audioResponse(AUDIO, 206, type)
      mocks.fetch.mockResolvedValue(response)
      await expect(getUrl('110', 320, COOKIE)).resolves.toBeNull()
      expect(cancel).toHaveBeenCalledTimes(1)
    },
  )

  it.each([
    Buffer.from('<html>Forbidden</html>'),
    Buffer.from('not an audio file'),
    Buffer.from([0xff, 0xff, 0xff, 0xff]),
  ])('rejects HTML and invalid bytes even with audio content type', async (bytes) => {
    mocks.fetch.mockResolvedValue(
      new Response(new Uint8Array(bytes), { status: 206, headers: { 'content-type': 'audio/mpeg' } }),
    )
    await expect(getUrl('110', 320, COOKIE)).resolves.toBeNull()
  })

  it('rejects absent and empty bodies', async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(null, { status: 200 }))
    await expect(getUrl('110', 320, COOKIE)).resolves.toBeNull()
    mocks.fetch.mockResolvedValueOnce(new Response(new Uint8Array(), { status: 206 }))
    await expect(getUrl('110', 320, COOKIE)).resolves.toBeNull()
  })

  it('rejects unexpected response URLs and auto-followed redirects', async () => {
    const first = audioResponse()
    Object.defineProperty(first.response, 'url', { value: 'https://evil.test/song.mp3' })
    mocks.fetch.mockResolvedValueOnce(first.response)
    await expect(getUrl('110', 320, COOKIE)).resolves.toBeNull()
    expect(first.cancel).toHaveBeenCalledOnce()
    const second = audioResponse()
    Object.defineProperty(second.response, 'redirected', { value: true })
    mocks.fetch.mockResolvedValueOnce(second.response)
    await expect(getUrl('110', 320, COOKIE)).resolves.toBeNull()
    expect(second.cancel).toHaveBeenCalledOnce()
  })

  it('times out the fetch after eight seconds without logging URL-bearing errors', async () => {
    vi.useFakeTimers()
    mocks.fetch.mockImplementation(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error(`${COOKIE} ${URL}`)))
        }),
    )
    const pending = getUrl('110', 320, COOKIE)
    await vi.advanceTimersByTimeAsync(8_000)
    await expect(pending).resolves.toBeNull()
    expect(mocks.fetch.mock.calls[0]![1].signal.aborted).toBe(true)
    expect(mocks.warn).toHaveBeenCalledExactlyOnceWith('netease_playback_failed')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('also times out a stalled body read and cancels the reader', async () => {
    vi.useFakeTimers()
    const cancel = vi.fn().mockResolvedValue(undefined)
    mocks.fetch.mockImplementation(async (_url, { signal }) => ({
      status: 206,
      redirected: false,
      url: URL,
      headers: new Headers({ 'content-type': 'audio/mpeg' }),
      body: {
        getReader: () => ({
          read: () =>
            new Promise((_resolve, reject) => {
              signal.addEventListener('abort', () => reject(new DOMException('fixture', 'AbortError')))
            }),
          cancel,
        }),
      },
    }))
    const pending = getUrl('110', 320, COOKIE)
    await vi.advanceTimersByTimeAsync(8_000)
    await expect(pending).resolves.toBeNull()
    expect(cancel).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not wait for an unresolved cancellation acknowledgement', async () => {
    const cancel = vi.fn(() => new Promise<void>(() => {}))
    mocks.fetch.mockResolvedValue({
      status: 206,
      redirected: false,
      url: URL,
      headers: new Headers({ 'content-type': 'audio/mpeg' }),
      body: { getReader: () => ({ read: async () => ({ done: false, value: AUDIO }), cancel }) },
    })
    await expect(getUrl('110', 320, COOKIE)).resolves.toBe(URL)
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('bounds empty chunk reads and cancels a non-progressing stream', async () => {
    const read = vi.fn().mockResolvedValue({ done: false, value: new Uint8Array() })
    const cancel = vi.fn().mockResolvedValue(undefined)
    mocks.fetch.mockResolvedValue({
      status: 206,
      redirected: false,
      url: URL,
      headers: new Headers(),
      body: { getReader: () => ({ read, cancel }) },
    })
    await expect(getUrl('110', 320, COOKIE)).resolves.toBeNull()
    expect(read).toHaveBeenCalledTimes(32)
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('bounds retained bytes and stops after the first sufficient chunk when Range is ignored', async () => {
    const bytes = new Uint8Array(100_000)
    bytes.set(AUDIO)
    const read = vi.fn().mockResolvedValue({ done: false, value: bytes })
    const cancel = vi.fn().mockResolvedValue(undefined)
    mocks.fetch.mockResolvedValue({
      status: 200,
      redirected: false,
      url: URL,
      headers: new Headers(),
      body: { getReader: () => ({ read, cancel }) },
    })
    await expect(getUrl('110', 320, COOKIE)).resolves.toBe(URL)
    expect(read).toHaveBeenCalledTimes(1)
    expect(cancel).toHaveBeenCalledOnce()
  })
})
