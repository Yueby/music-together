// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Track } from '@music-together/shared'
import type { MetadataRequestInit } from '@/lib/MetadataTransport'
import { createMappMetadataFetch } from '../../../mapp/src/compat/metadataFetch'
import { useSearch } from './useSearch'
import { useLyric } from './useLyric'
import { usePlayerStore } from '@/stores/playerStore'

const proxy = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('@/lib/config', () => ({ SERVER_URL: 'https://music.example.test' }))
vi.mock('@/lib/metadataFetch', () => ({
  metadataFetch: (url: string, init?: MetadataRequestInit) => proxy.fetch(url, init),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({
      ttmlEnabled: true,
      ttmlDbUrl: 'https://unreviewed.example.test/ncm-lyrics/%s.ttml',
    }),
  },
}))

const track: Track = {
  id: 'fixture-track',
  title: 'Fixture',
  artist: [],
  album: '',
  duration: 120,
  cover: '',
  source: 'netease',
  sourceId: '1',
  urlId: '1',
  lyricId: 'fixture-lyric',
}
function response(value: unknown) {
  return {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: Uint8Array.from(new TextEncoder().encode(JSON.stringify(value))),
  }
}

describe('shared search and lyric hooks with reviewed SDK metadata requests', () => {
  let root: ReturnType<typeof createRoot>
  let container: HTMLDivElement
  let search: ReturnType<typeof useSearch>
  let lyric: ReturnType<typeof useLyric>
  let request: ReturnType<
    typeof vi.fn<(endpoint: string, options?: { signal?: AbortSignal }) => Promise<ReturnType<typeof response>>>
  >

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('NATIVE_FETCH_TRIPWIRE')
      }),
    )
    request = vi.fn(async () => response({ tracks: [track], page: 1, hasMore: false }))
    const sdk = { permissions: { has: () => true }, http: { request } } as unknown as Parameters<
      typeof createMappMetadataFetch
    >[0]['sdk']
    proxy.fetch.mockImplementation(createMappMetadataFetch({ sdk, reviewedOrigin: 'https://music.example.test' }))
    usePlayerStore.getState().reset()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    function Harness() {
      search = useSearch('netease')
      lyric = useLyric()
      return null
    }
    await act(async () => root.render(<Harness />))
  })
  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })
  async function settle() {
    await act(async () => {
      for (let i = 0; i < 30; i++) await Promise.resolve()
    })
  }

  it('keeps the existing search result and pagination behavior without native fetch or Cookie transport', async () => {
    await act(async () => search.search(' fixture '))
    await settle()
    expect(search.results).toEqual([track])
    expect(search.loading).toBe(false)
    expect(search.hasSearched).toBe(true)
    expect(request).toHaveBeenCalledExactlyOnceWith(
      'musicSearch',
      expect.objectContaining({
        method: 'GET',
        responseType: 'bytes',
        query: { source: 'netease', keyword: 'fixture', limit: '20', page: '1', type: 'song' },
      }),
    )
    expect(request.mock.calls[0][1]).not.toHaveProperty('credentials')
    expect(request.mock.calls[0][1]).not.toHaveProperty('headers')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('aborts superseded searches and keeps the newer result when the older SDK request resolves late', async () => {
    let finish!: (value: ReturnType<typeof response>) => void
    request.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    await act(async () => search.search('older'))
    const oldSignal = request.mock.calls[0][1]!.signal!
    await act(async () => search.search('newer'))
    await settle()
    expect(oldSignal.aborted).toBe(true)
    expect(search.results).toEqual([track])
    finish(response({ tracks: [{ ...track, id: 'stale-result' }], hasMore: false }))
    await settle()
    expect(search.results).toEqual([track])
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('uses the approved lyric target and falls back from an unreviewed TTML URL without requesting it', async () => {
    request.mockResolvedValueOnce(response({ lyric: '[00:00.00]Fixture line', tlyric: '', romalrc: '', yrc: '' }))
    await act(async () => lyric.fetchLyric(track))
    expect(request).toHaveBeenCalledExactlyOnceWith(
      'musicLyric',
      expect.objectContaining({
        query: { source: 'netease', lyricId: 'fixture-lyric' },
        responseType: 'bytes',
      }),
    )
    expect(usePlayerStore.getState().lyric).toBe('[00:00.00]Fixture line')
    expect(usePlayerStore.getState().lyricLoading).toBe(false)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
