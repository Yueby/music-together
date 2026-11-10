import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TypedSocket } from './socket'

vi.mock('./config', () => ({ SERVER_URL: 'https://music.example.test' }))

const socket = {} as TypedSocket
const fetchFixture = vi.fn<typeof fetch>()
beforeEach(() => vi.stubGlobal('fetch', fetchFixture))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

describe('Web room check', () => {
  it('does not fetch on module import', async () => {
    vi.resetModules()
    await import('./roomCheck')
    expect(fetchFixture).not.toHaveBeenCalled()
  })

  it('uses the encoded original check URL, native credentials and supplied signal', async () => {
    const { roomCheck } = await import('./roomCheck')
    const signal = new AbortController().signal
    fetchFixture.mockResolvedValue(new Response(JSON.stringify({
      exists: true,
      name: 'Together',
      hasPassword: true,
      userCount: 0,
      password: 'private-password',
      userId: 'private-user',
      currentTrack: { title: 'not-part-of-preflight' },
    })))
    await expect(roomCheck(socket, 'a/../b?x=#', { signal })).resolves.toEqual({
      name: 'Together', hasPassword: true, userCount: 0,
    })
    expect(fetchFixture).toHaveBeenCalledExactlyOnceWith(
      'https://music.example.test/api/rooms/a%2F..%2Fb%3Fx%3D%23/check',
      { credentials: 'include', signal },
    )
  })

  it.each([400, 401, 403, 404, 500])('preserves null for HTTP %i without parsing the body', async (status) => {
    const { roomCheck } = await import('./roomCheck')
    const json = vi.fn()
    fetchFixture.mockResolvedValue({ ok: false, status, json } as unknown as Response)
    await expect(roomCheck(socket, 'room-a')).resolves.toBeNull()
    expect(json).not.toHaveBeenCalled()
  })

  it('retains successful HTTP semantics even if exists is false', async () => {
    const { roomCheck } = await import('./roomCheck')
    fetchFixture.mockResolvedValue(new Response(JSON.stringify({
      exists: false, name: 'Room', hasPassword: false, userCount: 2,
    })))
    await expect(roomCheck(socket, 'room-a')).resolves.toEqual({ name: 'Room', hasPassword: false, userCount: 2 })
  })

  it('propagates native aborts, transport errors and JSON errors', async () => {
    const { roomCheck } = await import('./roomCheck')
    for (const error of [new DOMException('cancelled', 'AbortError'), new Error('network')]) {
      fetchFixture.mockRejectedValueOnce(error)
      await expect(roomCheck(socket, 'room-a')).rejects.toBe(error)
    }
    fetchFixture.mockResolvedValueOnce(new Response('invalid JSON'))
    await expect(roomCheck(socket, 'room-a')).rejects.toBeInstanceOf(SyntaxError)
  })
})
