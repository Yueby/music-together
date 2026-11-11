import { EVENTS, QR_STATUS } from '@music-together/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  provider: {
    generateQrCode: vi.fn(),
    checkQrStatus: vi.fn(),
    getUserInfo: vi.fn(),
    getUserPlaylists: vi.fn(),
  },
  removeCookie: vi.fn(),
  addCookie: vi.fn(),
  hasCookie: vi.fn(() => false),
  mapping: { roomId: 'ROOM01', userId: 'user-1' } as { roomId: string; userId: string } | undefined,
  /** Rooms that currently exist, by id; each lists the ids of the users in it. */
  rooms: new Map<string, { users: Array<{ id: string }> }>(),
  checkAuthRateLimit: vi.fn(async () => true),
  checkAuthQrCheckRateLimit: vi.fn(async () => true),
}))

vi.mock('../middleware/socketRateLimiter.js', () => ({
  checkAuthRateLimit: mocks.checkAuthRateLimit,
  checkAuthQrCheckRateLimit: mocks.checkAuthQrCheckRateLimit,
}))
vi.mock('../repositories/roomRepository.js', () => ({
  roomRepo: { getSocketMapping: () => mocks.mapping, get: (roomId: string) => mocks.rooms.get(roomId) },
}))
vi.mock('../services/authProvider.js', () => ({
  AUTH_PROVIDERS: { netease: mocks.provider, tencent: mocks.provider, kugou: mocks.provider },
}))
vi.mock('../services/authService.js', () => ({
  addCookie: mocks.addCookie,
  removeCookie: mocks.removeCookie,
  hasCookie: mocks.hasCookie,
  getAllPlatformStatus: () => [],
  getUserAuthStatus: () => [],
}))

import { registerAuthController } from './authController.js'

type Handler = (data: unknown) => Promise<void> | void

function setup() {
  const handlers = new Map<string, Handler>()
  const emitted: Array<[string, unknown]> = []
  const socket = {
    id: 'socket-1',
    on: (event: string, handler: Handler) => handlers.set(event, handler),
    emit: (event: string, payload: unknown) => emitted.push([event, payload]),
    to: () => ({ emit: vi.fn() }),
  }
  const io = { to: () => ({ emit: vi.fn() }) }
  registerAuthController(io as never, socket as never)
  const send = async (event: string, data: unknown) => handlers.get(event)!(data)
  const last = (event: string) => emitted.filter(([name]) => name === event).at(-1)?.[1]
  return { send, last }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.mapping = { roomId: 'ROOM01', userId: 'user-1' }
  mocks.rooms.clear()
  mocks.rooms.set('ROOM01', { users: [{ id: 'user-1' }] })
  mocks.provider.generateQrCode.mockResolvedValue({ key: 'k', qrimg: 'img' })
})

describe('authController input', () => {
  it.each([undefined, null, {}, { platform: 'spotify' }, { platform: 5 }, 'netease'])(
    'refuses a QR request for %j without calling any provider',
    async (payload) => {
      const { send, last } = setup()
      await send(EVENTS.AUTH_REQUEST_QR, payload)
      expect(mocks.provider.generateQrCode).not.toHaveBeenCalled()
      expect(last(EVENTS.AUTH_QR_STATUS)).toMatchObject({ status: QR_STATUS.EXPIRED })
    },
  )

  it('serves a QR code for a known platform', async () => {
    const { send, last } = setup()
    await send(EVENTS.AUTH_REQUEST_QR, { platform: 'tencent' })
    expect(last(EVENTS.AUTH_QR_GENERATED)).toEqual({ key: 'k', qrimg: 'img' })
  })

  it.each([
    { platform: 'netease' },
    { platform: 'netease', key: 42 },
    { platform: 'netease', key: '' },
    { platform: 'netease', key: 'x'.repeat(501) },
    { platform: 'nope', key: 'k' },
  ])('refuses a QR status check for %j', async (payload) => {
    const { send, last } = setup()
    await send(EVENTS.AUTH_CHECK_QR, payload)
    expect(mocks.provider.checkQrStatus).not.toHaveBeenCalled()
    expect(last(EVENTS.AUTH_QR_STATUS)).toMatchObject({ status: QR_STATUS.EXPIRED })
  })

  it.each([
    { platform: 'netease' },
    { platform: 'netease', cookie: 123 },
    { platform: 'netease', cookie: '' },
    { platform: 'netease', cookie: 'x'.repeat(8001) },
    { platform: 'nope', cookie: 'c' },
    null,
  ])('refuses a cookie login for %j without verifying anything', async (payload) => {
    const { send, last } = setup()
    await send(EVENTS.AUTH_SET_COOKIE, payload)
    expect(mocks.provider.getUserInfo).not.toHaveBeenCalled()
    expect(mocks.addCookie).not.toHaveBeenCalled()
    expect(last(EVENTS.AUTH_SET_COOKIE_RESULT)).toMatchObject({ success: false, message: '参数不完整' })
  })

  it('polls the QR status on its own, wider budget, not the one shared by the other account events', async () => {
    const { send } = setup()
    mocks.provider.checkQrStatus.mockResolvedValue({ status: QR_STATUS.WAITING_SCAN, message: 'wait' })
    await send(EVENTS.AUTH_CHECK_QR, { platform: 'netease', key: 'k' })
    expect(mocks.checkAuthQrCheckRateLimit).toHaveBeenCalledOnce()
    expect(mocks.checkAuthRateLimit).not.toHaveBeenCalled()
  })

  it('does not ask the provider once the QR polling budget is spent', async () => {
    const { send } = setup()
    mocks.checkAuthQrCheckRateLimit.mockResolvedValueOnce(false)
    await send(EVENTS.AUTH_CHECK_QR, { platform: 'netease', key: 'k' })
    expect(mocks.provider.checkQrStatus).not.toHaveBeenCalled()
  })

  it('logs out of a known platform only', async () => {
    const { send } = setup()
    await send(EVENTS.AUTH_LOGOUT, { platform: 'bogus' })
    await send(EVENTS.AUTH_LOGOUT, undefined)
    expect(mocks.removeCookie).not.toHaveBeenCalled()
    await send(EVENTS.AUTH_LOGOUT, { platform: 'kugou' })
    expect(mocks.removeCookie).toHaveBeenCalledExactlyOnceWith('ROOM01', 'kugou', 'user-1')
  })
})

describe('authController membership changing while a login is being verified', () => {
  const info = { ok: true, data: { nickname: 'Me', vipType: 1, userId: 7 } }
  /** getUserInfo that lets `change` happen (the user leaves, the room goes away) before it answers. */
  const verifyingWhile = (change: () => void) =>
    mocks.provider.getUserInfo.mockImplementation(async () => {
      change()
      return info
    })

  describe.each([
    ['a pasted cookie', EVENTS.AUTH_SET_COOKIE, { platform: 'netease', cookie: 'MUSIC_U=x' }],
    ['a QR login', EVENTS.AUTH_CHECK_QR, { platform: 'netease', key: 'k' }],
  ])('%s', (_name, event, payload) => {
    beforeEach(() => {
      mocks.provider.checkQrStatus.mockResolvedValue({ status: QR_STATUS.SUCCESS, message: 'ok', cookie: 'MUSIC_U=x' })
    })

    it('is added to the room pool while the user is still in the room', async () => {
      verifyingWhile(() => undefined)
      const { send } = setup()
      await send(event, payload)
      expect(mocks.addCookie).toHaveBeenCalledExactlyOnceWith(
        'ROOM01',
        'netease',
        'user-1',
        'MUSIC_U=x',
        'Me',
        1,
        undefined,
      )
    })

    it('is not added when the room was destroyed in the meantime, so no cookie pool is re-created', async () => {
      verifyingWhile(() => mocks.rooms.delete('ROOM01'))
      const { send, last } = setup()
      await send(event, payload)
      expect(mocks.addCookie).not.toHaveBeenCalled()
      // The user is still told how the login went.
      expect(last(EVENTS.AUTH_SET_COOKIE_RESULT)).toMatchObject({ success: true, platform: 'netease' })
    })

    it('is not added when the user left the room in the meantime', async () => {
      verifyingWhile(() => {
        mocks.mapping = undefined
      })
      const { send } = setup()
      await send(event, payload)
      expect(mocks.addCookie).not.toHaveBeenCalled()
    })

    it('is not added when the user is no longer a member of the room', async () => {
      verifyingWhile(() => mocks.rooms.set('ROOM01', { users: [{ id: 'someone-else' }] }))
      const { send } = setup()
      await send(event, payload)
      expect(mocks.addCookie).not.toHaveBeenCalled()
    })
  })

  it('does not save an unverifiable KuGou/QQ cookie for a room that is gone either', async () => {
    mocks.provider.getUserInfo.mockImplementation(async () => {
      mocks.rooms.delete('ROOM01')
      return { ok: false, reason: 'error' }
    })
    vi.useFakeTimers()
    try {
      const { send, last } = setup()
      const pending = send(EVENTS.AUTH_SET_COOKIE, { platform: 'kugou', cookie: 'token=t;userid=1' })
      await vi.advanceTimersByTimeAsync(2_000)
      await pending
      expect(mocks.addCookie).not.toHaveBeenCalled()
      expect(last(EVENTS.AUTH_SET_COOKIE_RESULT)).toMatchObject({ success: true })
    } finally {
      vi.useRealTimers()
    }
  })

  it('treats a verification that merely failed (not expired) as "save it" for a NetEase paste, as before', async () => {
    mocks.provider.getUserInfo.mockResolvedValue({ ok: false, reason: 'error' })
    vi.useFakeTimers()
    try {
      const { send } = setup()
      const pending = send(EVENTS.AUTH_SET_COOKIE, { platform: 'netease', cookie: 'MUSIC_U=x' })
      await vi.advanceTimersByTimeAsync(2_000)
      await pending
      expect(mocks.addCookie).toHaveBeenCalledExactlyOnceWith('ROOM01', 'netease', 'user-1', 'MUSIC_U=x', '手动登录', 0)
    } finally {
      vi.useRealTimers()
    }
  })
})
