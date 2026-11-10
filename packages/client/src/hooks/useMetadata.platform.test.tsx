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
    getState: () => ({ ttmlEnabled: true }),
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
/** What `/api/music/ttml` returns: the server parses the library file, the client never sees XML. */
const wordByWordLines = [
  {
    startTime: 500,
    endTime: 2500,
    words: [
      { word: 'Hello ', startTime: 500, endTime: 1500 },
      { word: 'world', startTime: 1500, endTime: 2500 },
    ],
  },
]
const endpointsOf = (mock: { mock: { calls: unknown[][] } }) => mock.mock.calls.map(([endpoint]) => endpoint).sort()
const serverLyric = { lyric: '[00:00.00]Fixture line', tlyric: '', romalrc: '', yrc: '' }

function response(value: unknown, status = 200) {
  return {
    status,
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

  it('requests word-by-word TTML through the reviewed endpoint, never a library URL, and uses its lines', async () => {
    request.mockImplementation(async (endpoint) =>
      endpoint === 'musicTtml' ? response({ lines: wordByWordLines }) : response(serverLyric),
    )
    await act(async () => lyric.fetchLyric(track))
    expect(request).toHaveBeenCalledWith(
      'musicTtml',
      expect.objectContaining({ query: { source: 'netease', id: '1' }, responseType: 'bytes' }),
    )
    expect(usePlayerStore.getState().ttmlLines).toEqual(wordByWordLines)
    expect(usePlayerStore.getState().lyricLoading).toBe(false)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('starts the server lyric request together with TTML so a slow library never delays it', async () => {
    let finishTtml!: (value: ReturnType<typeof response>) => void
    request.mockImplementation((endpoint) =>
      endpoint === 'musicTtml'
        ? new Promise((resolve) => {
            finishTtml = resolve
          })
        : Promise.resolve(response(serverLyric)),
    )
    const pending = act(async () => lyric.fetchLyric(track))
    await settle()
    expect(endpointsOf(request)).toEqual(['musicLyric', 'musicTtml'])
    finishTtml(response({ lines: null }))
    await pending
    expect(usePlayerStore.getState().lyric).toBe('[00:00.00]Fixture line')
  })

  it.each([
    ['has no entry for the song', () => response({ lines: null })],
    ['is unavailable', () => response({ code: 'METADATA_FAILED' }, 502)],
    ['answers with nothing usable', () => response({ lines: [] })],
  ])('falls back to the server lyric when the TTML library %s', async (_name, ttmlAnswer) => {
    request.mockImplementation(async (endpoint) => (endpoint === 'musicTtml' ? ttmlAnswer() : response(serverLyric)))
    await act(async () => lyric.fetchLyric(track))
    expect(request).toHaveBeenCalledWith(
      'musicLyric',
      expect.objectContaining({ query: { source: 'netease', lyricId: 'fixture-lyric' }, responseType: 'bytes' }),
    )
    expect(usePlayerStore.getState().ttmlLines).toBeNull()
    expect(usePlayerStore.getState().lyric).toBe('[00:00.00]Fixture line')
    expect(usePlayerStore.getState().lyricLoading).toBe(false)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('drops everything when the track changes while TTML is still loading', async () => {
    let finishTtml!: (value: ReturnType<typeof response>) => void
    request.mockImplementation((endpoint) =>
      endpoint === 'musicTtml'
        ? new Promise((resolve) => {
            finishTtml = resolve
          })
        : Promise.resolve(response(serverLyric)),
    )
    const first = act(async () => lyric.fetchLyric(track))
    await settle()
    request.mockImplementation(async () => response({ lyric: '[00:00.00]Second', tlyric: '', romalrc: '', yrc: '' }))
    await act(async () => lyric.fetchLyric({ ...track, source: 'kugou', id: 'second' }))
    finishTtml(response({ lines: wordByWordLines }))
    await first
    expect(usePlayerStore.getState().ttmlLines).toBeNull()
    expect(usePlayerStore.getState().lyric).toBe('[00:00.00]Second')
  })

  it('skips TTML for sources without a library', async () => {
    request.mockResolvedValueOnce(response(serverLyric))
    await act(async () => lyric.fetchLyric({ ...track, source: 'kugou' }))
    expect(request).toHaveBeenCalledExactlyOnceWith('musicLyric', expect.anything())
  })
})
