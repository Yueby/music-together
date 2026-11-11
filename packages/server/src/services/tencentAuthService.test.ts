import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }))
vi.mock('../utils/logger.js', () => ({ logger: log }))

import { checkQrStatus } from './tencentAuthService.js'

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
    await expect(checkQrStatus('sig-html')).resolves.toMatchObject({ status: 800 })
    expect(log.warn).toHaveBeenCalledWith('QQ QR: unexpected ptqrlogin response format', { length: 20 })
  })

  it('reports a failed request as a failed check, not as a crash', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    await expect(checkQrStatus('sig-offline')).resolves.toMatchObject({ status: 800 })
  })

  it('answers "signed in" without a cookie when the one-time link is incomplete', async () => {
    fetchMock.mockResolvedValue(
      answer(callback('0', 'https://ssl.ptlogin2.graph.qq.com/check_sig?pttype=1&uin=o012345')),
    )
    await expect(checkQrStatus('sig-incomplete')).resolves.toEqual({ status: 803, message: '登录成功' })
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
