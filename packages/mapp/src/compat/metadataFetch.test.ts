import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HttpRequestOptions } from '@discourse-mini-app/sdk'
import { MAPP_METADATA_MAX_BYTES } from '@music-together/shared'
import type { MetadataRequestInit } from '../../../client/src/lib/MetadataTransport'
import { createMappMetadataFetch } from './metadataFetch'

type SDK = Parameters<typeof createMappMetadataFetch>[0]['sdk']
type SDKResponse = { status: number; headers: Record<string, string>; body: Uint8Array<ArrayBuffer> }
const origin = 'https://metadata.example'
const search = `${origin}/api/music/search?source=netease&keyword=fixture`
const lyric = `${origin}/api/music/lyric?source=tencent&lyricId=fixture-id`
const bytes = (text: string) => new TextEncoder().encode(text)
const response = (text = '{"tracks":[],"hasMore":false}', status = 200): SDKResponse => ({
  status,
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: bytes(text),
})
function fixture() {
  const request = vi
    .fn<(endpoint: string, options?: HttpRequestOptions<'bytes'>) => Promise<SDKResponse>>()
    .mockResolvedValue(response())
  const has = vi.fn(() => true)
  const sdk = { http: { request }, permissions: { has } } as unknown as SDK
  return { request, has, sdk, fetchMetadata: createMappMetadataFetch({ sdk, reviewedOrigin: origin }) }
}
function deferred() {
  let resolve!: (value: SDKResponse) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<SDKResponse>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
let nativeAccess: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.useFakeTimers()
  nativeAccess = vi.fn(() => {
    throw new Error('Native transport is forbidden in this fixture')
  })
  for (const name of ['fetch', 'XMLHttpRequest', 'Image']) vi.stubGlobal(name, nativeAccess)
})
afterEach(() => {
  expect(nativeAccess).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('reviewed Mapp metadata reads', () => {
  it('imports without network activity', async () => {
    vi.resetModules()
    expect((await import('./metadataFetch')).createMappMetadataFetch).toBeTypeOf('function')
  })

  it.each([
    ['/api/music/artist?source=netease&id=3684', 'musicArtist', { source: 'netease', id: '3684' }],
    [
      '/api/music/artist/songs?source=netease&id=3684&offset=50',
      'musicArtistSongs',
      { source: 'netease', id: '3684', offset: '50', limit: '30' },
    ],
    [
      '/api/music/artist/albums?source=netease&id=3684',
      'musicArtistAlbums',
      { source: 'netease', id: '3684', offset: '0', limit: '30' },
    ],
    [
      '/api/music/playlist?source=netease&id=77&type=album&total=12&limit=200',
      'musicPlaylist',
      { source: 'netease', id: '77', type: 'album', total: '12', limit: '200', offset: '0' },
    ],
  ])('reads %s through the reviewed %s endpoint with every query key present', async (path, endpoint, query) => {
    const f = fixture()
    await f.fetchMetadata(`${origin}${path}`)
    expect(f.request).toHaveBeenCalledExactlyOnceWith(
      endpoint,
      expect.objectContaining({ method: 'GET', query, responseType: 'bytes' }),
    )
  })

  it.each([
    '/api/music/playlist?source=netease&id=1&roomId=ABC123',
    '/api/music/playlist?source=netease&id=1&limit=201',
    '/api/music/artist?source=netease',
  ])('refuses %s before any SDK call', async (path) => {
    const f = fixture()
    await expect(f.fetchMetadata(`${origin}${path}`)).rejects.toThrow('METADATA_TARGET_REJECTED')
    expect(f.request).not.toHaveBeenCalled()
  })

  it('parses approved metadata queries under the sandbox dynamic-code restriction', async () => {
    const f = fixture()
    const compile = vi.spyOn(globalThis, 'Function').mockImplementation(() => {
      throw new EvalError('CSP_BLOCKED')
    })
    try {
      const result = await f.fetchMetadata(search)
      expect(await result.json()).toEqual({ tracks: [], hasMore: false })
      expect(compile).not.toHaveBeenCalled()
    } finally {
      compile.mockRestore()
    }
  })

  it.each([
    [search, 'musicSearch', { source: 'netease', keyword: 'fixture', limit: '20', page: '1', type: 'song' }],
    [lyric, 'musicLyric', { source: 'tencent', lyricId: 'fixture-id' }],
    [
      '/api/music/search?source=kugou&keyword=%E6%B5%8B%E8%AF%95%20%26%20music&limit=4&page=2&type=album',
      'musicSearch',
      { source: 'kugou', keyword: '测试 & music', limit: '4', page: '2', type: 'album' },
    ],
    ['/api/music/lyric?source=netease&lyricId=123', 'musicLyric', { source: 'netease', lyricId: '123' }],
  ])('uses the reviewed SDK endpoint and shared query defaults: %s', async (input, endpoint, query) => {
    const { fetchMetadata, request, has } = fixture()
    const result = await fetchMetadata(input, { method: 'GET', credentials: 'include' })
    expect(has).toHaveBeenCalledWith('network.request')
    expect(request).toHaveBeenCalledExactlyOnceWith(endpoint, {
      method: 'GET',
      query,
      responseType: 'bytes',
      timeoutMs: 20_000,
      signal: expect.any(AbortSignal),
      onDownloadProgress: expect.any(Function),
    })
    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({ tracks: [], hasMore: false })
    expect(await result.text()).toBe('{"tracks":[],"hasMore":false}')
    expect(Object.keys(result).sort()).toEqual(['json', 'ok', 'status', 'text'])
  })

  it('returns original valid lyric JSON text and an owned JSON value', async () => {
    const { fetchMetadata, request } = fixture()
    const text = ' { "lyric": "[00:01]测试", "translation": null } \n'
    const hostResponse = response(text)
    request.mockResolvedValueOnce(hostResponse)
    const result = await fetchMetadata(lyric)
    hostResponse.body.fill(0)
    expect(await result.text()).toBe(text)
    expect(await result.json()).toEqual({ lyric: '[00:01]测试', translation: null })
    expect(await result.json()).toBe(await result.json())
  })

  it.each(['omit', 'same-origin', 'include'] as const)('does not forward Web credentials: %s', async (credentials) => {
    const { fetchMetadata, request } = fixture()
    await fetchMetadata(search, { credentials })
    const options = request.mock.calls[0][1]!
    expect(options).not.toHaveProperty('credentials')
    expect(options).not.toHaveProperty('headers')
    expect(options).not.toHaveProperty('body')
    expect(options).not.toHaveProperty('json')
    expect(Object.keys(options).sort()).toEqual([
      'method',
      'onDownloadProgress',
      'query',
      'responseType',
      'signal',
      'timeoutMs',
    ])
  })

  it.each([
    '',
    'http://metadata.example',
    'https://metadata.example/',
    'https://metadata.example/path',
    'https://metadata.example?',
    'https://metadata.example#',
    'https://user:pass@metadata.example',
    'https://metadata.example:8443',
    'https://metadata.example:0',
    'https://metadata.example:99999',
    '//metadata.example',
    ' https://metadata.example',
    'https://metadata.example\\evil',
  ])('rejects an unreviewable origin: %s', (reviewedOrigin) => {
    const { sdk, request } = fixture()
    expect(() => createMappMetadataFetch({ sdk, reviewedOrigin })).toThrow('METADATA_ORIGIN_REJECTED')
    expect(request).not.toHaveBeenCalled()
  })

  it.each([
    'https://external.example/file.ttml',
    'https://external.example/api/music/search?source=netease&keyword=fixture',
    'http://metadata.example/api/music/search?source=netease&keyword=fixture',
    `${origin}:8443/api/music/search?source=netease&keyword=fixture`,
    'https://user:pass@metadata.example/api/music/search?source=netease&keyword=fixture',
    '//metadata.example/api/music/search?source=netease&keyword=fixture',
    `${search}#fragment`,
    `${search}#`,
    `${search}&cookies=fixture`,
    `${search}&url=https://external.example`,
    `${search}&sourceURL=https://external.example`,
    `${search}&headers=fixture`,
    `${search}&token=fixture`,
    `${search}&source=tencent`,
    `${search}&%73ource=tencent`,
    `${search}&keyword=second`,
    `${search}&limit=0`,
    `${search}&unknown=x`,
    `${search}&page=bad`,
    `${search}&keyword=%FF`,
    `${origin}/api/music/search?source=invalid&keyword=x`,
    `${origin}/api/music/search?source=netease`,
    `${origin}/api/music/lyric?source=netease&lyricId=x&lyricId=y`,
    `${origin}/api/music/lyric?source=netease`,
    `${origin}/api/music/playlist?id=x`,
    `${origin}/api/auth/status`,
    `${origin}/api/version`,
    `${origin}/api/music/cover?id=x`,
    `${origin}/api/rooms/fixture/check`,
    `${origin}/file.ttml`,
    `${origin}/api/music/url?source=netease&urlId=x`,
    `${origin}/api/music/../music/search?source=netease&keyword=x`,
    `${origin}/api/music/%73earch?source=netease&keyword=x`,
    `${origin}/api/music/search/?source=netease&keyword=x`,
    `${search}&keyword=%`,
    `${search}\n`,
    'api/music/search?source=netease&keyword=x',
    `${search}&keyword=${'x'.repeat(8192)}`,
  ])('rejects unapproved URLs and queries without invoking the SDK: %s', async (input) => {
    const { fetchMetadata, request } = fixture()
    await expect(fetchMetadata(input)).rejects.toThrow('METADATA_TARGET_REJECTED')
    expect(request).not.toHaveBeenCalled()
  })

  it.each([{ method: 'HEAD' }, { method: 'POST' }, { method: 'get' }])('rejects non-GET request init: %o', async (init) => {
    const { fetchMetadata, request } = fixture()
    await expect(fetchMetadata(search, init as MetadataRequestInit)).rejects.toThrow('METADATA_INIT_REJECTED')
    expect(request).not.toHaveBeenCalled()
  })
})

describe('bounded bytes-only JSON responses', () => {
  it.each([200, 201, 400, 401, 403, 404, 429, 500, 503])(
    'preserves HTTP status %i for existing res.ok checks',
    async (status) => {
      const { fetchMetadata, request } = fixture()
      request.mockResolvedValueOnce(response('{"code":"fixture"}', status))
      const result = await fetchMetadata(search)
      expect(result.status).toBe(status)
      expect(result.ok).toBe(status >= 200 && status < 300)
      expect(await result.json()).toEqual({ code: 'fixture' })
    },
  )

  it.each(['application/json', 'Application/JSON; Charset="UTF-8"'])('accepts JSON MIME %s', async (mime) => {
    const { fetchMetadata, request } = fixture()
    request.mockResolvedValueOnce({ ...response('null'), headers: { 'Content-Type': mime } })
    expect(await (await fetchMetadata(search)).json()).toBeNull()
  })

  it.each([
    '',
    'text/html',
    'text/plain',
    'application/problem+json',
    'application/jsonp',
    'application/json; charset=iso-8859-1',
    'application/json; charset=utf-16',
  ])('rejects MIME %s', async (mime) => {
    const { fetchMetadata, request } = fixture()
    request.mockResolvedValueOnce({ ...response(), headers: { 'content-type': mime } })
    await expect(fetchMetadata(search)).rejects.toThrow('METADATA_RESPONSE_REJECTED')
  })

  it.each(['', ' ', '<html>fixture</html>', '{invalid}', '{"x":1} trailing'])(
    'rejects empty or invalid JSON: %s',
    async (text) => {
      const { fetchMetadata, request } = fixture()
      request.mockResolvedValueOnce(response(text))
      await expect(fetchMetadata(search)).rejects.toThrow('METADATA_RESPONSE_REJECTED')
    },
  )

  it.each([
    new Uint8Array([0xff]),
    new Uint8Array([0xc0, 0xaf]),
    new Uint8Array([0x22, 0xe2, 0x82, 0x22]),
    new Uint8Array([0xff, 0xfe, 0x7b, 0x00, 0x7d, 0x00]),
  ])('rejects invalid UTF-8 without replacement decoding', async (body) => {
    const { fetchMetadata, request } = fixture()
    request.mockResolvedValueOnce({ ...response(), body })
    await expect(fetchMetadata(search)).rejects.toThrow('METADATA_RESPONSE_REJECTED')
  })

  it('rejects a response without a content type', async () => {
    const { fetchMetadata, request } = fixture()
    request.mockResolvedValueOnce({ ...response(), headers: {} })
    await expect(fetchMetadata(search)).rejects.toThrow('METADATA_RESPONSE_REJECTED')
  })

  it('rejects an excessive body', async () => {
    const { fetchMetadata, request } = fixture()
    request.mockResolvedValueOnce({ ...response(), body: new Uint8Array(MAPP_METADATA_MAX_BYTES + 1) })
    await expect(fetchMetadata(search)).rejects.toThrow('METADATA_TOO_LARGE')
  })

  it('accepts exactly the byte limit and copies the body before decoding', async () => {
    const { fetchMetadata, request } = fixture()
    const text = `"${'x'.repeat(MAPP_METADATA_MAX_BYTES - 2)}"`
    const value = response(text)
    value.headers['content-length'] = String(MAPP_METADATA_MAX_BYTES)
    request.mockResolvedValueOnce(value)
    const result = await fetchMetadata(search)
    value.body.fill(0)
    expect(await result.text()).toBe(text)
    expect(await result.json()).toBe('x'.repeat(MAPP_METADATA_MAX_BYTES - 2))
  })
})

describe('permission, cancellation, progress and deadline isolation', () => {
  it('refuses permission denial before invoking the SDK', async () => {
    const { fetchMetadata, request, has } = fixture()
    has.mockReturnValue(false)
    await expect(fetchMetadata(search)).rejects.toThrow('METADATA_PERMISSION_DENIED')
    expect(request).not.toHaveBeenCalled()
  })

  it.each([
    ['PERMISSION_DENIED', 'METADATA_PERMISSION_DENIED'],
    ['TIMEOUT', 'TIMEOUT'],
    ['INTERNAL', 'METADATA_REQUEST_FAILED'],
  ])('sanitizes SDK errors: %s', async (code, expected) => {
    const { fetchMetadata, request } = fixture()
    request.mockRejectedValueOnce(Object.assign(new Error('https://private.invalid?token=fixture'), { code }))
    await expect(fetchMetadata(search)).rejects.toThrow(new Error(expected))
  })

  it('sanitizes synchronous SDK errors', async () => {
    const { fetchMetadata, request } = fixture()
    request.mockImplementationOnce(() => {
      throw new Error('fixture-private-sdk-detail')
    })
    await expect(fetchMetadata(search)).rejects.toThrow(new Error('METADATA_REQUEST_FAILED'))
  })

  it.each(['APP_UNLOADED', 'USER_CANCELLED'])('uses hook-compatible AbortError for %s', async (code) => {
    const { fetchMetadata, request } = fixture()
    request.mockRejectedValueOnce({ code, message: 'fixture-private-sdk-detail' })
    const error = await fetchMetadata(search).catch((value: unknown) => value)
    expect(error).toBeInstanceOf(DOMException)
    expect(error).toMatchObject({ name: 'AbortError', message: 'METADATA_CANCELLED' })
  })

  it('does not invoke the SDK for an already aborted parent signal', async () => {
    const { fetchMetadata, request } = fixture()
    const controller = new AbortController()
    controller.abort('fixture-private-reason')
    await expect(fetchMetadata(search, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(request).not.toHaveBeenCalled()
  })

  it('settles parent cancellation immediately even for an uncooperative SDK, and unlinks listeners', async () => {
    const { fetchMetadata, request } = fixture()
    const pending = deferred()
    request.mockReturnValueOnce(pending.promise)
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    const result = fetchMetadata(search, { signal: controller.signal })
    const rejection = expect(result).rejects.toMatchObject({ name: 'AbortError', message: 'METADATA_CANCELLED' })
    const sdkSignal = request.mock.calls[0][1]!.signal!
    expect(sdkSignal).not.toBe(controller.signal)
    controller.abort('fixture-private-reason')
    await rejection
    expect(sdkSignal.aborted).toBe(true)
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
    const lateResponse = response()
    const readBody = vi.fn(() => {
      throw new Error('Late body must not be read')
    })
    Object.defineProperty(lateResponse, 'body', { get: readBody })
    pending.resolve(lateResponse)
    await Promise.resolve()
    expect(readBody).not.toHaveBeenCalled()
  })

  it('enforces an independent 20s TIMEOUT, ignores late rejection, and does not abort the parent', async () => {
    const { fetchMetadata, request } = fixture()
    const pending = deferred()
    request.mockReturnValueOnce(pending.promise)
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    const result = fetchMetadata(search, { signal: controller.signal })
    const rejection = expect(result).rejects.toThrow(new Error('TIMEOUT'))
    await vi.advanceTimersByTimeAsync(19_999)
    expect(request.mock.calls[0][1]!.signal!.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await rejection
    expect(request.mock.calls[0][1]!.signal!.aborted).toBe(true)
    expect(controller.signal.aborted).toBe(false)
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
    pending.reject(new Error('fixture-private-late-error'))
    await Promise.resolve()
  })

  it.each([{ loaded: MAPP_METADATA_MAX_BYTES + 1 }, { loaded: 1, total: MAPP_METADATA_MAX_BYTES + 1 }])(
    'aborts immediately on oversize progress without waiting for SDK settlement: %o',
    async (progress) => {
      const { fetchMetadata, request } = fixture()
      request.mockReturnValueOnce(new Promise(() => {}))
      const result = fetchMetadata(search)
      const rejection = expect(result).rejects.toThrow('METADATA_TOO_LARGE')
      const options = request.mock.calls[0][1]!
      options.onDownloadProgress!(progress)
      await rejection
      expect(options.signal!.aborted).toBe(true)
    },
  )

  it('cleans timers and listeners after success', async () => {
    const { fetchMetadata, request } = fixture()
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    const result = await fetchMetadata(search, { signal: controller.signal })
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
    expect(await result.json()).toEqual({ tracks: [], hasMore: false })
    await vi.advanceTimersByTimeAsync(20_000)
    expect(request.mock.calls[0][1]!.signal!.aborted).toBe(false)
  })

  it('keeps concurrent request cancellation isolated', async () => {
    const { fetchMetadata, request } = fixture()
    request.mockReturnValueOnce(new Promise(() => {}))
    const controller = new AbortController()
    const first = fetchMetadata(search, { signal: controller.signal })
    const rejection = expect(first).rejects.toMatchObject({ name: 'AbortError' })
    const second = fetchMetadata(lyric)
    controller.abort()
    await rejection
    expect((await second).ok).toBe(true)
    expect(request.mock.calls[1][1]!.signal!.aborted).toBe(false)
  })
})
