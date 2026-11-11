import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Artist } from '@music-together/shared'

const transport = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('@/lib/metadataFetch', () => ({ metadataFetch: transport.fetch }))
vi.mock('@/lib/config', () => ({ SERVER_URL: 'https://music.test' }))

import { findArtistByName } from './artistLookup'

const artist = (id: string, name: string): Artist => ({ id, name, cover: '', source: 'netease' })
const answer = (tracks: Artist[], status = 200) =>
  ({ ok: status < 400, status, json: async () => ({ tracks }) }) as Response

beforeEach(() => transport.fetch.mockReset())

describe('findArtistByName', () => {
  const signal = new AbortController().signal

  it('searches artists with every key the (mini-app) search target carries', async () => {
    transport.fetch.mockResolvedValue(answer([]))
    await findArtistByName('netease', 'JJ', signal)
    const url = new URL(transport.fetch.mock.calls[0][0] as string)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      source: 'netease',
      keyword: 'JJ',
      limit: '5',
      page: '1',
      type: 'artist',
    })
  })

  it('picks the hit with exactly that name over a better-ranked near match, ignoring case and spacing', async () => {
    transport.fetch.mockResolvedValue(answer([artist('1', 'JJ Lin Fans'), artist('2', ' ｊｊ ')]))
    expect(await findArtistByName('netease', 'JJ', signal)).toMatchObject({ id: '2' })
  })

  it('does not guess: with no hit of that name the artist is not found', async () => {
    transport.fetch.mockResolvedValueOnce(answer([artist('1', 'Other')]))
    expect(await findArtistByName('netease', 'JJ', signal)).toBeNull()
    transport.fetch.mockResolvedValueOnce(answer([]))
    expect(await findArtistByName('netease', 'JJ', signal)).toBeNull()
  })

  it('reports a failed lookup instead of pretending the artist does not exist', async () => {
    transport.fetch.mockResolvedValue(answer([], 503))
    await expect(findArtistByName('netease', 'JJ', signal)).rejects.toMatchObject({ status: 503 })
  })
})
