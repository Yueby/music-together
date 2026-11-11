import { beforeEach, describe, expect, it, vi } from 'vitest'

const ncm = vi.hoisted(() => ({
  login_qr_key: vi.fn(),
  login_qr_create: vi.fn(),
  login_qr_check: vi.fn(),
  login_status: vi.fn(),
  user_playlist: vi.fn(),
}))
vi.mock('@neteasecloudmusicapienhanced/api', () => ({ default: ncm }))

import { checkQrStatus, generateQrCode, getUserInfo, getUserPlaylists } from './neteaseAuthService.js'

beforeEach(() => Object.values(ncm).forEach((fn) => fn.mockReset()))

describe('NetEase QR login', () => {
  it('makes a code from a fresh key', async () => {
    ncm.login_qr_key.mockResolvedValue({ body: { data: { unikey: 'k1' } } })
    ncm.login_qr_create.mockResolvedValue({ body: { data: { qrimg: 'data:image/png;base64,AAAA' } } })
    await expect(generateQrCode()).resolves.toEqual({ key: 'k1', qrimg: 'data:image/png;base64,AAAA' })
    expect(ncm.login_qr_create).toHaveBeenCalledWith(expect.objectContaining({ key: 'k1', qrimg: true }))
  })

  it.each([
    ['no key', { body: { data: {} } }, undefined],
    ['no image', { body: { data: { unikey: 'k' } } }, { body: { data: {} } }],
  ])('makes no code when there is %s', async (_name, keyAnswer, imageAnswer) => {
    ncm.login_qr_key.mockResolvedValue(keyAnswer)
    ncm.login_qr_create.mockResolvedValue(imageAnswer)
    await expect(generateQrCode()).resolves.toBeNull()
  })

  it('makes no code when the call fails', async () => {
    ncm.login_qr_key.mockRejectedValue(new Error('down'))
    await expect(generateQrCode()).resolves.toBeNull()
  })

  it.each([
    [801, '等待扫码'],
    [802, '已扫码，等待确认'],
    [800, '二维码已过期，请重新获取'],
  ])('reports code %i', async (code, message) => {
    ncm.login_qr_check.mockResolvedValue({ body: { code, cookie: 'MUSIC_U=x' } })
    // A cookie only comes with a finished login.
    await expect(checkQrStatus('k')).resolves.toEqual({ status: code, message, cookie: undefined })
  })

  it('hands over the cookie on a finished login', async () => {
    ncm.login_qr_check.mockResolvedValue({ body: { code: 803, cookie: 'MUSIC_U=x' } })
    await expect(checkQrStatus('k')).resolves.toEqual({ status: 803, message: '登录成功', cookie: 'MUSIC_U=x' })
  })

  it('treats a failed or empty check as an expired code', async () => {
    ncm.login_qr_check.mockResolvedValueOnce({ body: {} })
    await expect(checkQrStatus('k')).resolves.toMatchObject({ status: 800 })
    ncm.login_qr_check.mockRejectedValueOnce(new Error('down'))
    await expect(checkQrStatus('k')).resolves.toMatchObject({ status: 800 })
  })
})

describe('NetEase getUserInfo', () => {
  it('reads the account, with its picture over https at a small size', async () => {
    ncm.login_status.mockResolvedValue({
      body: {
        data: { profile: { nickname: 'Me', vipType: 11, userId: 42, avatarUrl: 'http://p1.music.126.net/a.jpg' } },
      },
    })
    await expect(getUserInfo('MUSIC_U=x')).resolves.toEqual({
      ok: true,
      data: { nickname: 'Me', vipType: 11, userId: 42, avatarUrl: 'https://p1.music.126.net/a.jpg?param=96y96' },
    })
  })

  it('tolerates a profile without a picture, a name or a membership', async () => {
    ncm.login_status.mockResolvedValue({ body: { data: { profile: {} } } })
    await expect(getUserInfo('c')).resolves.toEqual({
      ok: true,
      data: { nickname: 'Unknown', vipType: 0, userId: 0, avatarUrl: undefined },
    })
  })

  it('says the login is expired when there is no profile, and only that', async () => {
    ncm.login_status.mockResolvedValue({ body: { data: {} } })
    await expect(getUserInfo('c')).resolves.toEqual({ ok: false, reason: 'expired' })
  })

  it('says it was a temporary failure when the call fails, so the cookie is kept', async () => {
    ncm.login_status.mockRejectedValue(new Error('down'))
    await expect(getUserInfo('c')).resolves.toEqual({ ok: false, reason: 'error' })
  })
})

describe('NetEase getUserPlaylists', () => {
  const profile = { body: { data: { profile: { nickname: 'Me', userId: 7 } } } }

  it("lists the account's playlists", async () => {
    ncm.login_status.mockResolvedValue(profile)
    ncm.user_playlist.mockResolvedValue({
      body: {
        playlist: [
          {
            id: 1,
            name: 'Liked',
            coverImgUrl: 'https://p/c.jpg',
            trackCount: 9,
            creator: { nickname: 'Me' },
            description: 'd',
          },
        ],
      },
    })
    await expect(getUserPlaylists('c')).resolves.toEqual([
      {
        id: '1',
        name: 'Liked',
        cover: 'https://p/c.jpg',
        trackCount: 9,
        source: 'netease',
        creator: 'Me',
        description: 'd',
      },
    ])
    expect(ncm.user_playlist).toHaveBeenCalledWith(expect.objectContaining({ uid: 7, cookie: 'c' }))
  })

  it.each([
    ['an expired login', { body: { data: {} } }, { body: { playlist: [] } }],
    ['an unexpected answer', profile, { body: { code: 500 } }],
  ])('lists nothing for %s', async (_name, loginAnswer, listAnswer) => {
    ncm.login_status.mockResolvedValue(loginAnswer)
    ncm.user_playlist.mockResolvedValue(listAnswer)
    await expect(getUserPlaylists('c')).resolves.toEqual([])
  })

  it('lists nothing when the call fails', async () => {
    ncm.login_status.mockResolvedValue(profile)
    ncm.user_playlist.mockRejectedValue(new Error('down'))
    await expect(getUserPlaylists('c')).resolves.toEqual([])
  })
})
