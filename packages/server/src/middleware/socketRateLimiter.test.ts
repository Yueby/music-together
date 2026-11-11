import { ERROR_CODE, EVENTS, LIMITS, QR_TIMING } from '@music-together/shared'
import { describe, expect, it, vi } from 'vitest'
import type { TypedSocket } from './types.js'
import {
  checkAuthQrCheckRateLimit,
  checkAuthRateLimit,
  checkRoomEntryRateLimit,
  checkSocketRateLimit,
  clearJoinPasswordFailures,
  isJoinPasswordLocked,
  recordJoinPasswordFailure,
} from './socketRateLimiter.js'

let sequence = 0
/** A fresh identity per test: the limiters keep their counters for the whole process. */
const newIdentity = () => `identity-${++sequence}`

function connection(identityUserId: string | undefined, id = `socket-${++sequence}`) {
  const emit = vi.fn()
  const socket = { id, data: { identityUserId }, emit } as unknown as TypedSocket
  return { socket, emit }
}

async function spend(check: (socket: TypedSocket) => Promise<boolean>, socket: TypedSocket, times: number) {
  const results: boolean[] = []
  for (let i = 0; i < times; i++) results.push(await check(socket))
  return results
}

describe('per-identity socket rate limits', () => {
  it('limits critical events to 10 per 5 seconds and tells the client', async () => {
    const { socket, emit } = connection(newIdentity())
    expect((await spend(checkSocketRateLimit, socket, 10)).every(Boolean)).toBe(true)
    expect(await checkSocketRateLimit(socket)).toBe(false)
    expect(emit).toHaveBeenCalledExactlyOnceWith(
      EVENTS.ROOM_ERROR,
      expect.objectContaining({ code: ERROR_CODE.RATE_LIMITED }),
    )
  })

  it('shares one budget between all connections (tabs) of an identity', async () => {
    const identity = newIdentity()
    const tabA = connection(identity)
    const tabB = connection(identity)
    await spend(checkSocketRateLimit, tabA.socket, 10)
    expect(await checkSocketRateLimit(tabB.socket)).toBe(false)
  })

  it('does not hand a fresh budget to an identity that disconnects and reconnects', async () => {
    const identity = newIdentity()
    const before = connection(identity, 'old-socket')
    await spend(checkSocketRateLimit, before.socket, 10)
    // The old socket is gone (nothing resets the counters); the same identity comes back on a new socket.
    const after = connection(identity, 'new-socket')
    expect(await checkSocketRateLimit(after.socket)).toBe(false)
  })

  it('keeps separate identities apart', async () => {
    const busy = connection(newIdentity())
    const calm = connection(newIdentity())
    await spend(checkSocketRateLimit, busy.socket, 11)
    expect(await checkSocketRateLimit(calm.socket)).toBe(true)
  })

  it('falls back to the socket id for a socket without identity', async () => {
    const { socket } = connection(undefined, 'anonymous-socket')
    await spend(checkSocketRateLimit, socket, 10)
    expect(await checkSocketRateLimit(socket)).toBe(false)
  })

  it('gives the account events 30 per minute', async () => {
    const { socket } = connection(newIdentity())
    expect((await spend(checkAuthRateLimit, socket, 30)).every(Boolean)).toBe(true)
    expect(await checkAuthRateLimit(socket)).toBe(false)
  })

  it('lets QR status polling run every 2 seconds for a whole minute and then some, on its own budget', async () => {
    const pollsPerMinute = 60_000 / QR_TIMING.POLL_INTERVAL_MS
    const { socket } = connection(newIdentity())

    const polls = await spend(checkAuthQrCheckRateLimit, socket, 60)
    expect(polls.length).toBeGreaterThan(pollsPerMinute)
    expect(polls.every(Boolean)).toBe(true)
    expect(await checkAuthQrCheckRateLimit(socket)).toBe(false)

    // Scanning used up the polling budget, not the one for requesting a QR code or pasting a cookie.
    expect(await checkAuthRateLimit(socket)).toBe(true)
  })

  it('does not let the other account events eat the QR polling budget', async () => {
    const { socket } = connection(newIdentity())
    await spend(checkAuthRateLimit, socket, 31)
    expect(await checkAuthQrCheckRateLimit(socket)).toBe(true)
  })

  it('keeps entering rooms on a budget apart from player controls', async () => {
    const { socket } = connection(newIdentity())
    expect((await spend(checkRoomEntryRateLimit, socket, 10)).every(Boolean)).toBe(true)
    expect(await checkRoomEntryRateLimit(socket)).toBe(false)
    expect(await checkSocketRateLimit(socket)).toBe(true)
  })
})

describe('room password guessing limit', () => {
  const max = LIMITS.ROOM_JOIN_PASSWORD_MAX_FAILURES

  async function failTimes(socket: TypedSocket, roomId: string, times: number) {
    for (let i = 0; i < times; i++) await recordJoinPasswordFailure(socket, roomId)
  }

  it('is open until the allowed number of wrong passwords has been sent', async () => {
    const { socket } = connection(newIdentity())
    expect(await isJoinPasswordLocked(socket, 'ROOM01')).toBe(false)
    await failTimes(socket, 'ROOM01', max - 1)
    expect(await isJoinPasswordLocked(socket, 'ROOM01')).toBe(false)
    await failTimes(socket, 'ROOM01', 1)
    expect(await isJoinPasswordLocked(socket, 'ROOM01')).toBe(true)
  })

  it('stays locked however many more guesses arrive', async () => {
    const { socket } = connection(newIdentity())
    await failTimes(socket, 'ROOM01', max + 10)
    expect(await isJoinPasswordLocked(socket, 'ROOM01')).toBe(true)
  })

  it('counts per identity and room, across the identity connections', async () => {
    const identity = newIdentity()
    const first = connection(identity)
    const second = connection(identity)
    await failTimes(first.socket, 'ROOM01', max)

    expect(await isJoinPasswordLocked(second.socket, 'ROOM01')).toBe(true)
    expect(await isJoinPasswordLocked(first.socket, 'ROOM02')).toBe(false)
    expect(await isJoinPasswordLocked(connection(newIdentity()).socket, 'ROOM01')).toBe(false)
  })

  it('forgets the typos after a correct password', async () => {
    const { socket } = connection(newIdentity())
    await failTimes(socket, 'ROOM01', max - 1)
    await clearJoinPasswordFailures(socket, 'ROOM01')
    await failTimes(socket, 'ROOM01', max - 1)
    expect(await isJoinPasswordLocked(socket, 'ROOM01')).toBe(false)
  })

  it('lifts the lock by itself after a minute', async () => {
    vi.useFakeTimers()
    try {
      const { socket } = connection(newIdentity())
      await failTimes(socket, 'ROOM01', max)
      expect(await isJoinPasswordLocked(socket, 'ROOM01')).toBe(true)
      await vi.advanceTimersByTimeAsync(61_000)
      expect(await isJoinPasswordLocked(socket, 'ROOM01')).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})
