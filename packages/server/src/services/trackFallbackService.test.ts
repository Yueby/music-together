import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Track } from '@music-together/shared'

const provider = vi.hoisted(() => ({ search: vi.fn() }))
vi.mock('./musicProvider.js', () => ({ musicProvider: provider }))

import { SearchError } from './catalogUtils.js'
import { findBestAlternativeTrack } from './trackFallbackService.js'

const track = (source: Track['source'], title: string, artist: string, duration = 200): Track => ({
  id: `${source}-${title}`,
  title,
  artist: [artist],
  album: '',
  duration,
  cover: '',
  source,
  sourceId: `${source}-${title}`,
  urlId: `${source}-${title}`,
})

beforeEach(() => provider.search.mockReset())

describe('findBestAlternativeTrack', () => {
  it('has no alternative, and does not throw, when the search on the other platform fails', async () => {
    // A plain function: a vi.fn() also watches the promise it returns and reports its rejection as unhandled.
    const spy = provider.search
    provider.search = (async () => {
      throw new SearchError()
    }) as typeof spy
    try {
      await expect(findBestAlternativeTrack(track('netease', 'Song', 'Singer'), 'tencent')).resolves.toBeNull()
    } finally {
      provider.search = spy
    }
  })

  it('searches the other platform for the title and the first artist', async () => {
    const original = track('netease', 'Song', 'Singer')
    provider.search.mockResolvedValue([track('tencent', 'Song', 'Singer')])
    const found = await findBestAlternativeTrack(original, 'tencent')
    expect(provider.search).toHaveBeenCalledWith('tencent', 'Song singer', 8, 1)
    expect(found?.track.source).toBe('tencent')
  })

  it('has no alternative when nothing was found', async () => {
    provider.search.mockResolvedValue([])
    await expect(findBestAlternativeTrack(track('netease', 'Song', 'Singer'), 'tencent')).resolves.toBeNull()
  })
})
