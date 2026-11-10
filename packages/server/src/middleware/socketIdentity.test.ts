import { ServerResponse, type IncomingMessage } from 'node:http'
import type { Request, Response } from 'express'
import { ERROR_CODE, EVENTS } from '@music-together/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { issueIdentityCookie } from '../services/identityService.js'
import { attachSocketIdentity, type SocketIdentityOptions } from './socketIdentity.js'
import type { TypedServer, TypedSocket } from './types.js'

vi.mock('../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn() } }))

const platformUrl = '/socket.io/?EIO=4&transport=websocket&mini_app_token=platform-token'
const UNAUTHORIZED = 'HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'

function cookie(userId = 'web-user'): string {
  let value = ''
  issueIdentityCookie(
    { secure: false, headers: {} } as Request,
    {
      setHeader: (_name: string, result: string) => {
        value = result
      },
    } as unknown as Response,
    userId,
  )
  return value
}

type EngineMiddleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => Promise<void>

/**
 * Mirrors the real order: the Engine.IO middleware runs before the upgrade is accepted,
 * and only an accepted request reaches the Socket.IO guard.
 */
function setup(
  options: SocketIdentityOptions = {},
  url = '/socket.io/?EIO=4&transport=websocket',
  headers: Record<string, unknown> = {},
) {
  let engineMiddleware: EngineMiddleware | undefined
  let guard!: (socket: TypedSocket, next: (err?: Error) => void) => void
  let connected: ((socket: TypedSocket) => void) | undefined
  attachSocketIdentity(
    {
      engine: {
        use: (middleware: EngineMiddleware) => {
          engineMiddleware = middleware
        },
      },
      use: (middleware: typeof guard) => {
        guard = middleware
      },
      on: (event: string, handler: (socket: TypedSocket) => void) => {
        if (event === 'connection') connected = handler
      },
    } as unknown as TypedServer,
    options,
  )
  const req = { url, headers, socket: { destroyed: false, end: vi.fn() } }
  const socket = {
    id: 'test-socket',
    request: req,
    handshake: { url, headers, auth: { userId: 'forged-owner', identityUserId: 'forged-owner' } },
    data: {},
    emit: vi.fn(),
    use: vi.fn(),
  } as unknown as TypedSocket
  const accepted = vi.fn()
  const next = vi.fn<(err?: Error) => void>()
  const upgrade = (res: ServerResponse = {} as ServerResponse) =>
    engineMiddleware ? engineMiddleware(req as unknown as IncomingMessage, res, accepted) : Promise.resolve(accepted())
  return {
    req,
    socket,
    accepted,
    next,
    upgrade,
    /** Socket.IO CONNECT stage; only reached when the upgrade was accepted. */
    connect: () => guard(socket, next),
    /** Upgrade, then connect when the upgrade was accepted. */
    run: async () => {
      await upgrade()
      if (accepted.mock.calls.length) guard(socket, next)
    },
    connected: () => connected?.(socket),
  }
}
afterEach(() => vi.useRealTimers())

describe('attachSocketIdentity', () => {
  it('preserves real signed Web Cookie authentication and ignores client auth IDs', async () => {
    const resolver = vi.fn()
    const h = setup({ resolvePlatformIdentity: resolver }, undefined, { cookie: cookie() })
    await h.run()
    expect(h.accepted).toHaveBeenCalledOnce()
    expect(h.next).toHaveBeenCalledExactlyOnceWith()
    expect(h.socket.data.identityUserId).toBe('web-user')
    expect(resolver).not.toHaveBeenCalled()
  })

  it.each([undefined, '', 'mt_identity=malformed'])(
    'rejects missing or invalid Web Cookie %# despite forged auth IDs',
    async (value) => {
      const h = setup({}, undefined, { cookie: value })
      await h.run()
      expect(h.next).toHaveBeenCalledExactlyOnceWith(new Error('UNAUTHENTICATED'))
      expect(h.socket.data.identityUserId).toBeUndefined()
    },
  )

  it('rejects expired Web Cookies', async () => {
    vi.useFakeTimers()
    const value = cookie()
    vi.advanceTimersByTime(366 * 24 * 60 * 60 * 1000)
    const h = setup({}, undefined, { cookie: value })
    await h.run()
    expect(h.next).toHaveBeenCalledExactlyOnceWith(new Error('UNAUTHENTICATED'))
  })

  it('keeps the platform branch disabled by default even with a valid Cookie', async () => {
    const h = setup({}, platformUrl, { cookie: cookie() })
    await h.run()
    expect(h.next).toHaveBeenCalledExactlyOnceWith(new Error('UNAUTHENTICATED'))
    expect(h.socket.data.identityUserId).toBeUndefined()
  })

  it('refuses a platform handshake that skipped pre-upgrade verification, whatever the Cookie says', () => {
    const h = setup({ resolvePlatformIdentity: vi.fn() }, platformUrl, { cookie: cookie() })
    h.connect()
    expect(h.next).toHaveBeenCalledExactlyOnceWith(new Error('UNAUTHENTICATED'))
    expect(h.socket.data.identityUserId).toBeUndefined()
  })

  it.each([
    'mini_app_token=',
    'mini_app_token',
    'mini_app_token=x&mini_app_token=y',
    'mini_app_token=x&%6dini_app_token=y',
  ])('rejects invalid explicit platform marker %s with 401 and no Cookie fallback', async (query) => {
    const resolver = vi.fn().mockResolvedValue({ userId: 'mapp_valid' })
    const h = setup({ resolvePlatformIdentity: resolver }, '/socket.io/?' + query, { cookie: cookie() })
    await h.run()
    expect(h.req.socket.end).toHaveBeenCalledExactlyOnceWith(UNAUTHORIZED)
    expect(h.accepted).not.toHaveBeenCalled()
    expect(h.next).not.toHaveBeenCalled()
    expect(resolver).not.toHaveBeenCalled()
  })

  it('treats an encoded token name as a platform request, so it cannot hide behind the Cookie', async () => {
    const resolver = vi.fn().mockRejectedValue(new Error('rejected'))
    const h = setup({ resolvePlatformIdentity: resolver }, '/socket.io/?%6dini_app_token=x', { cookie: cookie() })
    await h.run()
    expect(resolver).toHaveBeenCalledOnce()
    expect(h.req.socket.end).toHaveBeenCalledExactlyOnceWith(UNAUTHORIZED)
    expect(h.accepted).not.toHaveBeenCalled()
  })

  it('verifies before the upgrade, uses only the server request URL, and leaves lifetime unchanged', async () => {
    vi.useFakeTimers()
    const resolver = vi.fn().mockResolvedValue({ userId: 'mapp_verified' })
    const h = setup({ resolvePlatformIdentity: resolver }, platformUrl, {
      origin: 'https://linux.do',
      cookie: cookie(),
    })
    h.socket.handshake.url = '/client-forged-url'
    h.socket.handshake.auth.url = '/client-forged-url'
    await h.upgrade()
    expect(resolver).toHaveBeenCalledExactlyOnceWith({ url: platformUrl, origin: 'https://linux.do' })
    expect(h.accepted).toHaveBeenCalledOnce()
    expect(h.req.socket.end).not.toHaveBeenCalled()
    expect(h.next).not.toHaveBeenCalled()
    h.connect()
    expect(h.socket.data.identityUserId).toBe('mapp_verified')
    expect(h.next).toHaveBeenCalledExactlyOnceWith()
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(900_000)
    expect(h.next).toHaveBeenCalledTimes(1)
  })

  it('emits only the server-verified platform ID after connection, once and without credentials', async () => {
    const h = setup({ resolvePlatformIdentity: vi.fn().mockResolvedValue({ userId: 'mapp_verified' }) }, platformUrl)
    await h.run()
    expect(h.socket.emit).not.toHaveBeenCalled()
    h.connected()
    expect(h.socket.emit).toHaveBeenCalledExactlyOnceWith(EVENTS.IDENTITY_READY, { userId: 'mapp_verified' })
    h.connected()
    expect(h.socket.emit).toHaveBeenCalledTimes(1)
    const web = setup({ resolvePlatformIdentity: vi.fn() }, undefined, { cookie: cookie() })
    await web.run()
    web.connected()
    expect(web.socket.emit).not.toHaveBeenCalled()
  })

  it('lets platform connections use room and music-account events and refuses everything else', async () => {
    const h = setup({ resolvePlatformIdentity: vi.fn().mockResolvedValue({ userId: 'mapp_verified' }) }, platformUrl)
    await h.run()
    expect(h.socket.use).toHaveBeenCalledOnce()
    const guard = vi.mocked(h.socket.use).mock.calls[0]![0]
    for (const event of [
      EVENTS.ROOM_JOIN,
      EVENTS.QUEUE_ADD,
      EVENTS.PLAYER_PAUSE,
      EVENTS.NTP_PING,
      EVENTS.AUTH_REQUEST_QR,
      EVENTS.AUTH_CHECK_QR,
      EVENTS.AUTH_SET_COOKIE,
      EVENTS.AUTH_LOGOUT,
      EVENTS.AUTH_GET_STATUS,
      EVENTS.PLAYLIST_GET_MY,
    ]) {
      const next = vi.fn()
      guard([event], next)
      expect(next, String(event)).toHaveBeenCalledOnce()
    }
    for (const event of [
      // Server-to-client events must never be accepted from a client, and unknown events are refused.
      EVENTS.AUTH_QR_GENERATED,
      EVENTS.AUTH_MY_STATUS,
      EVENTS.PLAYLIST_MY_LIST,
      'unknown:event',
    ]) {
      const next = vi.fn()
      guard([event], next)
      expect(next).not.toHaveBeenCalled()
      expect(h.socket.emit).toHaveBeenCalledWith(
        EVENTS.ROOM_ERROR,
        expect.objectContaining({ code: ERROR_CODE.NO_PERMISSION }),
      )
    }
    const web = setup({}, undefined, { cookie: cookie() })
    await web.run()
    expect(web.socket.use).not.toHaveBeenCalled()
  })

  it.each(['reject', 'throw'])(
    'handles resolver %s with 401, no Cookie fallback and no leaked errors',
    async (mode) => {
      vi.useFakeTimers()
      const resolver = vi.fn(() => {
        if (mode === 'throw') throw new Error('sensitive platform failure')
        return Promise.reject(new Error('sensitive platform failure'))
      })
      const h = setup({ resolvePlatformIdentity: resolver }, platformUrl, { cookie: cookie() })
      await h.run()
      expect(h.req.socket.end).toHaveBeenCalledExactlyOnceWith(UNAUTHORIZED)
      expect(h.accepted).not.toHaveBeenCalled()
      expect(h.socket.data.identityUserId).toBeUndefined()
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it.each([undefined, null, {}, { userId: '' }, { userId: 'bad uid' }, { userId: 'x'.repeat(129) }, { userId: 12 }])(
    'rejects malformed resolver identity %#',
    async (identity) => {
      const h = setup({ resolvePlatformIdentity: vi.fn().mockResolvedValue(identity) }, platformUrl, {
        cookie: cookie(),
      })
      await h.run()
      expect(h.req.socket.end).toHaveBeenCalledExactlyOnceWith(UNAUTHORIZED)
      expect(h.accepted).not.toHaveBeenCalled()
    },
  )

  it.each(['resolve', 'reject'])('bounds resolver to six seconds and ignores late %s', async (outcome) => {
    vi.useFakeTimers()
    let resolve!: (value: { userId: string }) => void
    let reject!: (reason: Error) => void
    const resolver = vi.fn(
      () =>
        new Promise<{ userId: string }>((yes, no) => {
          resolve = yes
          reject = no
        }),
    )
    const h = setup({ resolvePlatformIdentity: resolver }, platformUrl, { cookie: cookie() })
    const pending = h.upgrade()
    await vi.advanceTimersByTimeAsync(5999)
    expect(h.req.socket.end).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await pending
    expect(h.req.socket.end).toHaveBeenCalledExactlyOnceWith(UNAUTHORIZED)
    if (outcome === 'resolve') resolve({ userId: 'late-owner' })
    else reject(new Error('late failure'))
    await vi.advanceTimersByTimeAsync(0)
    expect(h.accepted).not.toHaveBeenCalled()
    h.connect()
    expect(h.next).toHaveBeenCalledExactlyOnceWith(new Error('UNAUTHENTICATED'))
    expect(h.socket.data.identityUserId).toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('answers a rejected long-polling handshake with a real 401 response', async () => {
    const h = setup({ resolvePlatformIdentity: vi.fn().mockRejectedValue(new Error('rejected')) }, platformUrl)
    const res = new ServerResponse({ method: 'GET', httpVersionMajor: 1, httpVersionMinor: 1 } as IncomingMessage)
    const end = vi.spyOn(res, 'end').mockImplementation(() => res)
    await h.upgrade(res)
    expect(res.statusCode).toBe(401)
    expect(end).toHaveBeenCalledOnce()
    expect(h.req.socket.end).not.toHaveBeenCalled()
    expect(h.accepted).not.toHaveBeenCalled()
  })

  it('does not accept an upgrade whose connection closed during verification', async () => {
    const h = setup({ resolvePlatformIdentity: vi.fn().mockResolvedValue({ userId: 'mapp_verified' }) }, platformUrl)
    h.req.socket.destroyed = true
    await h.upgrade()
    expect(h.accepted).not.toHaveBeenCalled()
    expect(h.req.socket.end).not.toHaveBeenCalled()
  })
})
