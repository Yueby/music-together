import { beforeEach, describe, expect, it, vi } from 'vitest'
import { appQueryClient, clearAppQueryCache, fetchAppQuery, invalidateAccountQueries, queryKeys } from './queryClient'
import { resetAllRoomState } from './resetStores'

beforeEach(clearAppQueryCache)

describe('app query cache', () => {
  it('keeps a shared transport alive when one of its callers cancels', async () => {
    let resolve!: (value: string) => void
    const fetchData = vi.fn<(signal: AbortSignal) => Promise<string>>(() => new Promise((done) => {
      resolve = done
    }))
    const key = queryKeys.search('netease', 'song', 'shared', 1)
    const first = new AbortController()
    const second = new AbortController()
    const firstRequest = fetchAppQuery(key, 60_000, fetchData, first.signal)
    const secondRequest = fetchAppQuery(key, 60_000, fetchData, second.signal)

    first.abort()
    await expect(firstRequest).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchData).toHaveBeenCalledOnce()
    expect(fetchData.mock.calls[0][0].aborted).toBe(false)

    resolve('shared result')
    await expect(secondRequest).resolves.toBe('shared result')
    expect(appQueryClient.getQueryData(key)).toBe('shared result')
  })

  it('evicts account data and aborts pending personal reads on account invalidation', async () => {
    const home = queryKeys.discover.home('netease', 'ROOM01')
    const daily = queryKeys.discover.daily('netease', 'ROOM01')
    const radar = queryKeys.discover.radar('netease')
    const mine = queryKeys.playlist.mine('netease', 'ROOM01', '1', 0, 50)
    for (const key of [home, daily, radar]) appQueryClient.setQueryData(key, ['cached'])

    let transportSignal!: AbortSignal
    const pending = fetchAppQuery(mine, 60_000, (signal) => {
      transportSignal = signal
      return new Promise(() => {})
    }, new AbortController().signal)
    invalidateAccountQueries()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(transportSignal.aborted).toBe(true)
    for (const key of [home, daily, mine]) expect(appQueryClient.getQueryState(key)).toBeUndefined()
    expect(appQueryClient.getQueryData(radar)).toEqual(['cached'])
  })

  it('clears query data when the room is reset', async () => {
    const key = queryKeys.discover.daily('netease', 'ROOM01')
    appQueryClient.setQueryData(key, ['previous room'])
    resetAllRoomState()
    expect(appQueryClient.getQueryState(key)).toBeUndefined()

    const fetchData = vi.fn().mockResolvedValue(['fresh result'])
    await expect(fetchAppQuery(key, 60_000, fetchData, new AbortController().signal)).resolves.toEqual(['fresh result'])
    expect(fetchData).toHaveBeenCalledOnce()
  })
})
