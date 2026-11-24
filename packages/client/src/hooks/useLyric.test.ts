// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import type { Track } from '@music-together/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/metadataFetch', () => ({ metadataFetch: fetchMock }))

import { usePlayerStore } from '@/stores/playerStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useLyric } from './useLyric'
import { clearAppQueryCache } from '@/lib/queryClient'

const track = { id: 't', source: 'netease', sourceId: 'sid', lyricId: 'lid' } as Track
const ttmlLines = [{ startTime: 0, endTime: 1000, words: [{ word: 'ttml', startTime: 0, endTime: 1000 }] }]

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}
const json = (body: unknown) => ({ ok: true, json: async () => body }) as Response

let fetchLyric: (t: Track) => Promise<void>

beforeEach(() => {
  clearAppQueryCache()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  fetchMock.mockReset()
  usePlayerStore.getState().setLyric('', '')
  usePlayerStore.getState().setTtmlLines(null)
  useSettingsStore.setState({ ttmlEnabled: true })
  fetchLyric = renderHook(() => useLyric()).result.current.fetchLyric
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useLyric', () => {
  it('reuses the base lyric and retries a failed TTML request for the same track', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ lyric: '[00:00.00]base' }))
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce(json({ lines: ttmlLines }))

    await act(() => fetchLyric(track))
    expect(usePlayerStore.getState().lyric).toBe('[00:00.00]base')
    expect(usePlayerStore.getState().ttmlLines).toBeNull()

    await act(() => fetchLyric(track))
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(usePlayerStore.getState().ttmlLines).toEqual(ttmlLines)

    await act(() => fetchLyric(track))
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(usePlayerStore.getState().lyric).toBe('[00:00.00]base')
    expect(usePlayerStore.getState().ttmlLines).toEqual(ttmlLines)
  })

  it('shows the base lyric as soon as it arrives, without waiting for a slow TTML', async () => {
    const ttml = deferred<Response>()
    fetchMock.mockImplementation((url: string) =>
      url.includes('/api/music/ttml')
        ? ttml.promise
        : Promise.resolve(json({ lyric: '[00:00.00]base', tlyric: '', romalrc: '', yrc: '' })),
    )

    let done!: Promise<void>
    await act(async () => {
      done = fetchLyric(track)
    })

    expect(usePlayerStore.getState().lyric).toBe('[00:00.00]base')
    expect(usePlayerStore.getState().lyricLoading).toBe(false)
    expect(usePlayerStore.getState().ttmlLines).toBeNull()

    await act(async () => {
      ttml.resolve(json({ lines: ttmlLines }))
      await done
    })
    // Word-by-word lyrics take over once they arrive.
    expect(usePlayerStore.getState().ttmlLines).toEqual(ttmlLines)
  })

  it('keeps TTML lines when the base lyric arrives after them', async () => {
    const base = deferred<Response>()
    fetchMock.mockImplementation((url: string) =>
      url.includes('/api/music/ttml') ? Promise.resolve(json({ lines: ttmlLines })) : base.promise,
    )

    let done!: Promise<void>
    await act(async () => {
      done = fetchLyric(track)
    })
    expect(usePlayerStore.getState().ttmlLines).toEqual(ttmlLines)

    await act(async () => {
      base.resolve(json({ lyric: '[00:00.00]base', tlyric: '', romalrc: '', yrc: '' }))
      await done
    })
    expect(usePlayerStore.getState().ttmlLines).toEqual(ttmlLines)
    expect(usePlayerStore.getState().lyricLoading).toBe(false)
  })

  it('does not cache empty lyric responses or responses marked cacheable: false', async () => {
    useSettingsStore.setState({ ttmlEnabled: false })
    fetchMock
      .mockResolvedValueOnce(json({ lyric: '', tlyric: '', romalrc: '', yrc: '', cacheable: false }))
      .mockResolvedValueOnce(json({ lyric: '[00:00.00]fallback lrc', tlyric: '', romalrc: '', yrc: '', cacheable: false }))
      .mockResolvedValueOnce(json({ lyric: '[00:00.00]full lyric', tlyric: '', romalrc: '', yrc: '', cacheable: true }))

    await act(() => fetchLyric(track))
    expect(usePlayerStore.getState().lyric).toBe('')

    // Second fetch must hit the network because empty/uncacheable result was not kept
    await act(() => fetchLyric(track))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(usePlayerStore.getState().lyric).toBe('[00:00.00]fallback lrc')

    // Third fetch must still hit the network because second response was cacheable: false
    await act(() => fetchLyric(track))
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(usePlayerStore.getState().lyric).toBe('[00:00.00]full lyric')

    // Fourth fetch reuses the cached cacheable: true lyric
    await act(() => fetchLyric(track))
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
