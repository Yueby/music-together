import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const meting = vi.hoisted(() => ({ search: vi.fn(), pic: vi.fn() }))

vi.mock('@meting/core', () => ({
  default: class {
    search = meting.search
    pic = meting.pic
    format() {}
  },
}))
vi.mock('./neteasePlayback.js', () => ({ getNeteasePlaybackUrl: vi.fn() }))
vi.mock('../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))

import { musicProvider } from './musicProvider.js'
import type { Track } from '@music-together/shared'

/** Every test uses its own keyword and hashes: the provider keeps its caches for the life of the process. */
let n = 0

/** The raw answer of Meting's Kugou search (`data.info`) for `count` songs with the given hash prefix. */
function kugouSearchAnswer(prefix: string, count: number) {
  return JSON.stringify({
    data: { info: Array.from({ length: count }, (_, i) => ({ hash: `${prefix}${i}`, filename: `A - Song ${i}` })) },
  })
}

const picAnswer = (url: string) => JSON.stringify({ url })
const never = () => new Promise<string>(() => {})

beforeEach(() => {
  meting.search.mockReset()
  meting.pic.mockReset()
})
afterEach(() => vi.useRealTimers())

describe('batch cover resolution', () => {
  it('gives up on a single cover request after a few seconds, leaving that track without a cover', async () => {
    vi.useFakeTimers()
    const prefix = `slow${++n}-`
    meting.search.mockResolvedValue(kugouSearchAnswer(prefix, 2))
    meting.pic.mockImplementation((picId: string) =>
      picId === `${prefix}0` ? never() : Promise.resolve(picAnswer('http://img.kugou.com/{size}/ok.jpg')),
    )

    const pending = musicProvider.search('kugou', `slow cover ${n}`)
    await vi.advanceTimersByTimeAsync(4_000)
    const tracks = await pending

    expect(tracks.map((t: Track) => t.cover)).toEqual(['', 'http://img.kugou.com/5000/ok.jpg'])
  })

  it('does not remember a timed-out or empty cover answer: the next request asks again', async () => {
    vi.useFakeTimers()
    const prefix = `retry${++n}-`
    meting.search.mockResolvedValue(kugouSearchAnswer(prefix, 2))
    meting.pic.mockImplementation((picId: string) => (picId === `${prefix}0` ? never() : Promise.resolve(picAnswer(''))))

    const first = musicProvider.search('kugou', `retry cover ${n}`)
    await vi.advanceTimersByTimeAsync(4_000)
    await first
    expect(meting.pic).toHaveBeenCalledTimes(2)

    // Both covers (one timed out, one answered an empty address) are asked for again, and now arrive.
    meting.pic.mockReset()
    meting.pic.mockResolvedValue(picAnswer('http://img.kugou.com/{size}/now.jpg'))
    const second = await musicProvider.search('kugou', `retry cover again ${n}`)
    expect(meting.search).toHaveBeenCalledTimes(2)
    expect(second.map((t) => t.cover)).toEqual(Array(2).fill('http://img.kugou.com/5000/now.jpg'))
    expect(meting.pic).toHaveBeenCalledTimes(2)
  })

  it('bounds the whole batch: a long queue of slow requests does not hold the answer for a minute', async () => {
    vi.useFakeTimers()
    const prefix = `many${++n}-`
    meting.search.mockResolvedValue(kugouSearchAnswer(prefix, 30))
    meting.pic.mockImplementation(() => never())

    let settled = false
    const pending = musicProvider.search('kugou', `many covers ${n}`).finally(() => {
      settled = true
    })
    await vi.advanceTimersByTimeAsync(10_000)
    const tracks = await pending

    expect(settled).toBe(true)
    expect(tracks).toHaveLength(30)
    expect(tracks.every((t) => t.cover === '')).toBe(true)
    // Requests still queued at the deadline were never started: 3 at a time, 4s each, 10s => at most 9 calls.
    expect(meting.pic.mock.calls.length).toBeLessThanOrEqual(9)
  })

  it('still resolves covers within the time box when the platform answers promptly', async () => {
    const prefix = `fast${++n}-`
    meting.search.mockResolvedValue(kugouSearchAnswer(prefix, 5))
    meting.pic.mockResolvedValue(picAnswer('http://img.kugou.com/{size}/c.jpg'))
    const tracks = await musicProvider.search('kugou', `fast covers ${n}`)
    expect(tracks.every((t) => t.cover === 'http://img.kugou.com/5000/c.jpg')).toBe(true)
  })
})
