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
}))

vi.mock('../middleware/socketRateLimiter.js', () => ({ checkAuthRateLimit: async () => true }))
vi.mock('../repositories/roomRepository.js', () => ({
  roomRepo: { getSocketMapping: () => mocks.mapping },
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

  it('logs out of a known platform only', async () => {
    const { send } = setup()
    await send(EVENTS.AUTH_LOGOUT, { platform: 'bogus' })
    await send(EVENTS.AUTH_LOGOUT, undefined)
    expect(mocks.removeCookie).not.toHaveBeenCalled()
    await send(EVENTS.AUTH_LOGOUT, { platform: 'kugou' })
    expect(mocks.removeCookie).toHaveBeenCalledExactlyOnceWith('ROOM01', 'kugou', 'user-1')
  })
})
