import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }))
vi.mock('../utils/logger.js', () => ({ logger: log }))

import {
  checkQrStatus,
  generateQrCode,
  getUserInfo,
  getUserPlaylists,
  toMetingKugouCookie,
} from './kugouAuthService.js'

const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  Object.values(log).forEach((fn) => fn.mockReset())
})
afterEach(() => vi.unstubAllGlobals())

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

/** Answer by which Kugou endpoint is called, so a test reads as "this endpoint says that". */
function answers(routes: Record<string, unknown>) {
  fetchMock.mockImplementation(async (url: string) => {
    const path = Object.keys(routes).find((p) => url.includes(p))
    if (!path) throw new Error(`unexpected request: ${url}`)
    const value = routes[path]
    if (value instanceof Error) throw value
    return json(value)
  })
}

describe('Kugou QR login', () => {
  it('makes a code image from the key Kugou hands out', async () => {
    answers({ '/v2/qrcode': { data: { qrcode: 'key-1' } } })
    const code = await generateQrCode()
    expect(code?.key).toBe('key-1')
    expect(code?.qrimg).toMatch(/^data:image\/png;base64,/)
  })

  it.each([
    ['no key', { data: {} }],
    ['an answer without data', {}],
  ])('makes no code for %s', async (_name, body) => {
    answers({ '/v2/qrcode': body })
    await expect(generateQrCode()).resolves.toBeNull()
  })

  it('makes no code when the request fails', async () => {
    fetchMock.mockResolvedValue(json({}, 503))
    await expect(generateQrCode()).resolves.toBeNull()
  })

  it.each([
    [1, 801, '等待扫码'],
    [2, 802, '已扫码，等待确认'],
    [0, 800, '二维码已过期，请重新获取'],
    [7, 800, '二维码已过期，请重新获取'],
  ])('maps Kugou status %i to %i', async (raw, status, message) => {
    answers({ '/v2/get_userinfo_qrcode': { data: { status: raw, token: 't', userid: 1 } } })
    // Not finished, so no credentials are handed over even if the answer carries some.
    await expect(checkQrStatus('k')).resolves.toEqual({ status, message })
  })

  it('hands over the cookie on a finished login', async () => {
    answers({ '/v2/get_userinfo_qrcode': { data: { status: 4, token: 'tok', userid: 99 } } })
    await expect(checkQrStatus('k')).resolves.toEqual({
      status: 803,
      message: '登录成功',
      cookie: 'token=tok;userid=99',
    })
  })

  it('does not call a login finished when the credentials are missing', async () => {
    answers({ '/v2/get_userinfo_qrcode': { data: { status: 4 } } })
    await expect(checkQrStatus('k')).resolves.toEqual({ status: 803, message: '登录成功' })
  })

  it('reports a failed check as an expired code, not as a crash', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    await expect(checkQrStatus('k')).resolves.toEqual({ status: 800, message: '检查状态失败' })
  })
})

describe('Kugou getUserInfo', () => {
  const cookie = 'token=SECRET-TOKEN;userid=42'

  it('reads membership and nickname', async () => {
    answers({
      '/v1/get_union_vip': { data: { is_vip: 1, vip_type: 3 } },
      '/v3/get_my_info': { data: { nick_name: 'Me' } },
    })
    await expect(getUserInfo(cookie)).resolves.toEqual({
      ok: true,
      data: { nickname: 'Me', vipType: 3, userId: 42 },
    })
  })

  it('is not a member when Kugou does not say so', async () => {
    answers({
      '/v1/get_union_vip': { data: { is_vip: 0, vip_type: 0 } },
      '/v3/get_my_info': { data: { nick_name: 'Me' } },
    })
    await expect(getUserInfo(cookie)).resolves.toMatchObject({ ok: true, data: { vipType: 0 } })
  })

  it('falls back to a name made from the id when the nickname cannot be had', async () => {
    answers({
      '/v1/get_union_vip': { data: { is_vip: 1, vip_type: 1 } },
      '/v3/get_my_info': new Error('down'),
    })
    await expect(getUserInfo(cookie)).resolves.toMatchObject({ ok: true, data: { nickname: '酷狗用户42' } })
  })

  it.each(['token=only', 'userid=1', ''])(
    'says the login is expired for the cookie %j, without asking Kugou',
    async (c) => {
      await expect(getUserInfo(c)).resolves.toEqual({ ok: false, reason: 'expired' })
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it('says the login is expired when the membership answer has no data', async () => {
    answers({ '/v1/get_union_vip': { error_code: 20018 } })
    await expect(getUserInfo(cookie)).resolves.toEqual({ ok: false, reason: 'expired' })
  })

  it('says it was a temporary failure when the request fails, so the cookie is kept', async () => {
    fetchMock.mockResolvedValue(json({}, 500))
    await expect(getUserInfo(cookie)).resolves.toEqual({ ok: false, reason: 'error' })
  })

  it('never writes the token to the log', async () => {
    answers({ '/v1/get_union_vip': { error_code: 1 } })
    await getUserInfo(cookie)
    fetchMock.mockResolvedValue(json({}, 500))
    await getUserInfo(cookie)
    const logged = JSON.stringify(Object.values(log).flatMap((fn) => fn.mock.calls))
    expect(logged).not.toContain('SECRET-TOKEN')
  })
})

describe('Kugou getUserPlaylists', () => {
  const cookie = 'token=t;userid=42'

  it("lists the account's playlists, preferring the global id", async () => {
    answers({
      '/v7/get_all_list': {
        data: {
          info: [
            { global_collection_id: 'g1', listid: 5, name: 'Liked', pic: 'https://c/1.jpg', count: 12 },
            { listid: 6, name: 'Old', img: 'https://c/2.jpg', total: 3 },
          ],
        },
      },
    })
    await expect(getUserPlaylists(cookie)).resolves.toEqual([
      { id: 'g1', name: 'Liked', cover: 'https://c/1.jpg', trackCount: 12, source: 'kugou' },
      { id: '6', name: 'Old', cover: 'https://c/2.jpg', trackCount: 3, source: 'kugou' },
    ])
  })

  it.each([
    ['an answer without a list', { data: {} }],
    ['an answer without data', {}],
  ])('lists nothing for %s', async (_name, body) => {
    answers({ '/v7/get_all_list': body })
    await expect(getUserPlaylists(cookie)).resolves.toEqual([])
  })

  it('lists nothing for a cookie without credentials, without asking Kugou', async () => {
    await expect(getUserPlaylists('token=only')).resolves.toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('lists nothing when the request fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    await expect(getUserPlaylists(cookie)).resolves.toEqual([])
  })
})

describe('Kugou request timeout', () => {
  it('gives every request a 10 second abort signal, so a black-holed endpoint cannot hang a login', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    answers({ '/v2/qrcode': { data: { qrcode: 'key-1' } } })
    await generateQrCode()
    expect(timeout).toHaveBeenCalledWith(10_000)
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.signal).toBeInstanceOf(AbortSignal)
    timeout.mockRestore()
  })

  it('treats a request that times out like any other failure', async () => {
    const timedOut = new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    fetchMock.mockRejectedValue(timedOut)
    await expect(generateQrCode()).resolves.toBeNull()
    await expect(checkQrStatus('k')).resolves.toMatchObject({ status: 800 })
    await expect(getUserInfo('token=t;userid=1')).resolves.toEqual({ ok: false, reason: 'error' })
  })
})

describe('toMetingKugouCookie', () => {
  // @meting/core only resolves a signed-in stream URL when the cookie has both `t` and `KugooID`.
  it('turns the QR login cookie into the shape Meting reads', () => {
    expect(toMetingKugouCookie('token=abc;userid=123')).toBe('t=abc;KugooID=123')
  })

  it('keeps the device ids Meting can use', () => {
    expect(toMetingKugouCookie('token=abc; userid=123; dfid=D; mid=M; other=x')).toBe('t=abc;KugooID=123;mid=M;dfid=D')
  })

  it('leaves a cookie that already has t and KugooID alone', () => {
    const cookie = 't=abc; KugooID=123; mid=M'
    expect(toMetingKugouCookie(cookie)).toBe(cookie)
  })

  it('leaves a cookie without credentials as it came', () => {
    expect(toMetingKugouCookie('token=only')).toBe('token=only')
    expect(toMetingKugouCookie('')).toBe('')
  })
})
