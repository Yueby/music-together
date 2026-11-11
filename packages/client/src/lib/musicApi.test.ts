import { beforeEach, describe, expect, it, vi } from 'vitest'

const transport = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('@/lib/metadataFetch', () => ({ metadataFetch: transport.fetch }))
vi.mock('@/lib/config', () => ({ SERVER_URL: 'https://music.test' }))

import { ApiError, getMusicJson, statusOf } from './musicApi'

const answer = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as Response

beforeEach(() => transport.fetch.mockReset())

describe('getMusicJson', () => {
  it('reads JSON from the music API with credentials, numbers included in the query', async () => {
    transport.fetch.mockResolvedValue(answer({ items: [1] }))
    const signal = new AbortController().signal
    await expect(getMusicJson('artist/songs', { source: 'netease', offset: 50 }, signal)).resolves.toEqual({
      items: [1],
    })
    expect(transport.fetch).toHaveBeenCalledWith('https://music.test/api/music/artist/songs?source=netease&offset=50', {
      signal,
      credentials: 'include',
    })
  })

  it.each([400, 401, 404, 503])('reports HTTP %i as an ApiError carrying the status', async (status) => {
    transport.fetch.mockResolvedValue(answer({}, status))
    const error = await getMusicJson('x', {}).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ApiError)
    expect(statusOf(error)).toBe(status)
  })

  it('has no status for anything else, such as a network failure', () => {
    expect(statusOf(new TypeError('offline'))).toBeUndefined()
    expect(statusOf(undefined)).toBeUndefined()
  })
})
