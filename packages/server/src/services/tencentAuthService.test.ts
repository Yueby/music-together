import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }))
vi.mock('../utils/logger.js', () => ({ logger: log }))

import { checkQrStatus, generateQrCode, getPlaylistTracks, getUserPlaylists } from './tencentAuthService.js'

const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  Object.values(log).forEach((fn) => fn.mockReset())
})
afterEach(() => vi.unstubAllGlobals())

const answer = (text: string) => new Response(text, { status: 200 })
const callback = (code: string, url = '', msg = '', nickname = '') =>
  `ptuiCB('${code}','0','${url}','0','${msg}', '${nickname}');`.replace(", '", ",'")

describe('QQ Music favorites', () => {
  it('shares encrypted UIN lookups across concurrent and later pages while keeping accounts separate', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const uin = new URL(url).searchParams.get('userid')
      return uin
        ? Response.json({ data: { creator: { encrypt_uin: `encrypted-${uin}` } } })
        : Response.json({ req: { code: 0, data: { songlist: [{ mid: 'track' }], total_song_num: 400 } } })
    })
    const cookie = 'uin=67890; qm_keyst=k'
    await Promise.all([getPlaylistTracks('201', 1, 100, cookie), getPlaylistTracks('201', 2, 100, cookie)])
    await getPlaylistTracks('201', 3, 100, cookie)
    await getPlaylistTracks('201', 1, 100, 'uin=54321; qm_keyst=k')

    const lookups = fetchMock.mock.calls.filter(([url]) => String(url).includes('fcg_get_profile_homepage'))
    expect(lookups).toHaveLength(2)
    const params = fetchMock.mock.calls.filter(([url]) => String(url).includes('musics.fcg'))
      .map(([, init]) => JSON.parse(init.body).req.param)
    expect(params.map(({ enc_host_uin, song_begin }) => [enc_host_uin, song_begin])).toEqual([
      ['encrypted-67890', 0], ['encrypted-67890', 100], ['encrypted-67890', 200], ['encrypted-54321', 0],
    ])
  })
})

describe('QQ Music QR status', () => {
  it.each([
    ['66', 801],
    ['67', 802],
    ['65', 800],
  ])('maps the login code %s to status %i', async (code, status) => {
    fetchMock.mockResolvedValue(answer(callback(code)))
    await expect(checkQrStatus(`sig-${code}`)).resolves.toMatchObject({ status })
  })

  it('does not know a code it was not told about, and says which', async () => {
    fetchMock.mockResolvedValue(answer(callback('99')))
    await expect(checkQrStatus('sig-unknown')).resolves.toEqual({ status: 800, message: '未知状态 (99)' })
  })

  it('reports an answer it cannot read as a failed check', async () => {
    fetchMock.mockResolvedValue(answer('<html>blocked</html>'))
    await expect(checkQrStatus('sig-html')).resolves.toMatchObject({ status: 801 })
    expect(log.warn).toHaveBeenCalledWith('QQ QR: unexpected ptqrlogin response format', { length: 20 })
  })

  it('keeps polling after a failed request without logging the raw error', async () => {
    fetchMock.mockRejectedValue(new Error('offline SECRET-SESSION'))
    await expect(checkQrStatus('sig-offline')).resolves.toMatchObject({ status: 801 })
    expect(log.warn).toHaveBeenCalledExactlyOnceWith('QQ QR check failed')
  })

  it('asks for a new code when the one-time link is incomplete', async () => {
    fetchMock.mockResolvedValue(
      answer(callback('0', 'https://ssl.ptlogin2.graph.qq.com/check_sig?pttype=1&uin=o012345')),
    )
    await expect(checkQrStatus('sig-incomplete')).resolves.toEqual({
      status: 800, message: '未获取到有效登录凭据，请重新扫码',
    })
  })

  it('does not report a login when check_sig returns no usable session credentials', async () => {
    const link = 'https://ssl.ptlogin2.graph.qq.com/check_sig?uin=o012345&ptsigx=PTSIGX'
    fetchMock.mockResolvedValueOnce(answer(callback('0', link))).mockResolvedValueOnce(answer(''))
    await expect(checkQrStatus('sig-no-session')).resolves.toMatchObject({ status: 800 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not log raw Set-Cookie headers when generating a code fails', async () => {
    const response = answer('')
    response.headers.append('Set-Cookie', 'session=SECRET-HEADER')
    fetchMock.mockResolvedValue(response)
    await expect(generateQrCode()).resolves.toBeNull()
    expect(log.error).toHaveBeenCalledExactlyOnceWith('QQ QR: qrsig not found in response headers', { setCookieCount: 1 })
  })

  it('never writes the one-time login link or the sign-in response to the log', async () => {
    const secret = 'SECRET-PTSIGX-TOKEN'
    fetchMock.mockResolvedValue(
      answer(
        callback('0', `https://ssl.ptlogin2.graph.qq.com/check_sig?pttype=1&uin=o012345&ptsigx=${secret}`, '', 'nick'),
      ),
    )
    // The follow-up steps get the same unusable answer and fail: only what is logged matters here.
    await checkQrStatus('sig-leak').catch(() => undefined)
    const logged = JSON.stringify(Object.values(log).flatMap((fn) => fn.mock.calls))
    expect(logged).not.toContain(secret)
    expect(logged).not.toContain('ptsigx')
  })
})

describe('QQ Music request timeouts', () => {
  const signalsOfAllRequests = () => fetchMock.mock.calls.map(([, init]) => (init as RequestInit | undefined)?.signal)

  it('bounds every step of the sign-in (poll, check_sig, OAuth code) with an abort signal', async () => {
    const link = 'https://ssl.ptlogin2.graph.qq.com/check_sig?pttype=1&uin=o012345&ptsigx=PTSIGX'
    const session = new Response('', { headers: { 'Set-Cookie': 'p_skey=fixture-session' } })
    fetchMock
      .mockResolvedValueOnce(answer(callback('0', link)))
      .mockResolvedValueOnce(session)
      .mockImplementation(async () => new Response('', { status: 200 }))
    await expect(checkQrStatus('sig-timeouts')).resolves.toMatchObject({ status: 803 })

    // ptqrlogin + check_sig + oauth2.0/authorize
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3)
    for (const signal of signalsOfAllRequests()) expect(signal).toBeInstanceOf(AbortSignal)
  })

  it('bounds the encrypted-uin lookup of the playlist list with an abort signal', async () => {
    fetchMock.mockImplementation(async () => new Response('{}', { status: 200 }))
    await expect(getUserPlaylists('uin=12345; qm_keyst=k')).resolves.toEqual([])

    const lookups = fetchMock.mock.calls.filter(([url]) => String(url).includes('fcg_get_profile_homepage'))
    expect(lookups).toHaveLength(1)
    expect((lookups[0][1] as RequestInit).signal).toBeInstanceOf(AbortSignal)
    for (const signal of signalsOfAllRequests()) expect(signal).toBeInstanceOf(AbortSignal)
  })

  it('keeps polling when a sign-in step times out', async () => {
    const link = 'https://ssl.ptlogin2.graph.qq.com/check_sig?pttype=1&uin=o012345&ptsigx=PTSIGX'
    fetchMock
      .mockResolvedValueOnce(answer(callback('0', link)))
      .mockRejectedValue(new DOMException('timeout', 'TimeoutError'))
    await expect(checkQrStatus('sig-hang')).resolves.toMatchObject({ status: 801 })
  })
})
