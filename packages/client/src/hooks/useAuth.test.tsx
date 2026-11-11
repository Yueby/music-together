// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EVENTS } from '@music-together/shared'

type Handler = (data: unknown) => void

const fixture = vi.hoisted(() => {
  const handlers = new Map<string, Set<(data: unknown) => void>>()
  return {
    handlers,
    socket: {
      on: (event: string, fn: (data: unknown) => void) => {
        if (!handlers.has(event)) handlers.set(event, new Set())
        handlers.get(event)!.add(fn)
      },
      off: (event: string, fn: (data: unknown) => void) => handlers.get(event)?.delete(fn),
      emit: vi.fn(),
    },
    runtime: { platformAccounts: true },
    removeAuthCookie: vi.fn(),
  }
})

vi.mock('@/providers/SocketProvider', () => ({ useSocketContext: () => ({ socket: fixture.socket }) }))
vi.mock('@/lib/hostRuntime', () => ({ hostRuntime: fixture.runtime }))
vi.mock('@/lib/storage', () => ({ storage: { removeAuthCookie: fixture.removeAuthCookie } }))

import { useAuth } from './useAuth'

const receive = (event: string, data: unknown) =>
  act(() => fixture.handlers.get(event)?.forEach((fn: Handler) => fn(data)))
const listeners = () => Array.from(fixture.handlers.values()).reduce((n, set) => n + set.size, 0)

let latest: ReturnType<typeof useAuth>
let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

function Probe() {
  const value = useAuth()
  useEffect(() => {
    latest = value
  })
  return null
}

beforeEach(() => {
  fixture.handlers.clear()
  fixture.socket.emit.mockReset()
  fixture.removeAuthCookie.mockReset()
  fixture.runtime.platformAccounts = true
  container = document.createElement('div')
  root = createRoot(container)
  act(() => root.render(<Probe />))
})

afterEach(() => {
  act(() => root.unmount())
})

describe('useAuth status', () => {
  it('asks for the current status on mount, so a late mount does not miss it', () => {
    expect(fixture.socket.emit).toHaveBeenCalledWith(EVENTS.AUTH_GET_STATUS)
  })

  it('knows the status is loaded only once the personal status arrived', () => {
    expect(latest.statusLoaded).toBe(false)
    receive(EVENTS.AUTH_STATUS_UPDATE, [{ platform: 'netease', loggedIn: true }])
    expect(latest.platformStatus).toEqual([{ platform: 'netease', loggedIn: true }])
    expect(latest.statusLoaded).toBe(false)

    receive(EVENTS.AUTH_MY_STATUS, [{ platform: 'netease', loggedIn: true }])
    expect(latest.myStatus).toEqual([{ platform: 'netease', loggedIn: true }])
    expect(latest.statusLoaded).toBe(true)
  })

  it('stops listening when it goes away', () => {
    expect(listeners()).toBe(4)
    act(() => root.unmount())
    expect(listeners()).toBe(0)
    root = createRoot(container)
    act(() => root.render(<Probe />))
  })
})

describe('useAuth QR login', () => {
  it('asks for a code for the platform and shows it as loading until one arrives', () => {
    act(() => latest.requestQrCode('tencent'))
    expect(fixture.socket.emit).toHaveBeenCalledWith(EVENTS.AUTH_REQUEST_QR, { platform: 'tencent' })
    expect(latest.qrPlatform).toBe('tencent')
    expect(latest.isQrLoading).toBe(true)

    receive(EVENTS.AUTH_QR_GENERATED, { key: 'k', qrimg: 'img' })
    expect(latest.qrData).toEqual({ key: 'k', qrimg: 'img' })
    expect(latest.qrStatus).toEqual({ status: 801, message: '等待扫码' })
    expect(latest.isQrLoading).toBe(false)
  })

  it('checks the code against the platform it was asked for, even right after switching', () => {
    act(() => latest.requestQrCode('kugou'))
    act(() => latest.checkQrStatus('k'))
    expect(fixture.socket.emit).toHaveBeenLastCalledWith(EVENTS.AUTH_CHECK_QR, { key: 'k', platform: 'kugou' })
  })

  it('keeps showing the waiting states, and stops loading on done or expired', () => {
    act(() => latest.requestQrCode('netease'))
    receive(EVENTS.AUTH_QR_STATUS, { status: 802, message: '已扫码，等待确认' })
    expect(latest.qrStatus).toEqual({ status: 802, message: '已扫码，等待确认' })
    expect(latest.isQrLoading).toBe(true)

    receive(EVENTS.AUTH_QR_STATUS, { status: 803, message: '登录成功' })
    expect(latest.isQrLoading).toBe(false)

    act(() => latest.requestQrCode('netease'))
    receive(EVENTS.AUTH_QR_STATUS, { status: 800, message: '二维码已过期，请重新获取' })
    expect(latest.isQrLoading).toBe(false)
  })

  it('clears the code and the status on request and on reset', () => {
    receive(EVENTS.AUTH_QR_GENERATED, { key: 'k', qrimg: 'img' })
    act(() => latest.requestQrCode('netease'))
    expect(latest.qrData).toBeNull()
    expect(latest.qrStatus).toBeNull()

    receive(EVENTS.AUTH_QR_GENERATED, { key: 'k2', qrimg: 'img2' })
    act(() => latest.resetQr())
    expect(latest.qrData).toBeNull()
    expect(latest.qrStatus).toBeNull()
    expect(latest.isQrLoading).toBe(false)
  })
})

describe('useAuth actions', () => {
  it('sends a cookie for the platform', () => {
    act(() => latest.setCookie('netease', 'MUSIC_U=x'))
    expect(fixture.socket.emit).toHaveBeenCalledWith(EVENTS.AUTH_SET_COOKIE, {
      platform: 'netease',
      cookie: 'MUSIC_U=x',
    })
  })

  it('removes the saved cookie as well as telling the server on logout', () => {
    act(() => latest.logout('tencent'))
    expect(fixture.removeAuthCookie).toHaveBeenCalledWith('tencent')
    expect(fixture.socket.emit).toHaveBeenCalledWith(EVENTS.AUTH_LOGOUT, { platform: 'tencent' })
  })
})

describe('useAuth in a host without platform accounts', () => {
  beforeEach(() => {
    act(() => root.unmount())
    fixture.handlers.clear()
    fixture.socket.emit.mockReset()
    fixture.runtime.platformAccounts = false
    root = createRoot(container)
    act(() => root.render(<Probe />))
  })

  it('neither listens nor asks for anything', () => {
    expect(listeners()).toBe(0)
    expect(fixture.socket.emit).not.toHaveBeenCalled()

    act(() => {
      latest.requestQrCode('netease')
      latest.checkQrStatus('k')
      latest.setCookie('netease', 'c')
      latest.logout('netease')
    })
    expect(fixture.socket.emit).not.toHaveBeenCalled()
    expect(fixture.removeAuthCookie).not.toHaveBeenCalled()
    expect(latest.isQrLoading).toBe(false)
  })
})
