// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const transport = vi.hoisted(() => ({ fetch: vi.fn() }))
const toast = vi.hoisted(() => ({ error: vi.fn() }))
vi.mock('@/lib/metadataFetch', () => ({ metadataFetch: transport.fetch }))
vi.mock('@/lib/config', () => ({ SERVER_URL: 'https://music.test' }))
vi.mock('sonner', () => ({ toast }))

import { useSearch, type SearchType } from './useSearch'
import type { MusicSource } from '@music-together/shared'

const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as Response

function deferred() {
  let resolve!: (response: Response) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<Response>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const songs = (...ids: string[]) => ids.map((id) => ({ id, title: id }))

let latest: ReturnType<typeof useSearch>
let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

function Probe({ source, type }: { source: MusicSource; type?: SearchType }) {
  const value = useSearch(source, type)
  useEffect(() => {
    latest = value
  })
  return null
}

const flush = () => act(async () => {})
const render = (source: MusicSource = 'netease', type?: SearchType) =>
  act(() => root.render(<Probe source={source} type={type} />))
const urlOf = (call: number) => new URL(transport.fetch.mock.calls[call][0] as string)

beforeEach(() => {
  transport.fetch.mockReset()
  toast.error.mockReset()
  container = document.createElement('div')
  root = createRoot(container)
  render()
})

afterEach(() => {
  act(() => root.unmount())
})

describe('useSearch', () => {
  it('searches the chosen platform and type, with the keyword trimmed and encoded', async () => {
    transport.fetch.mockResolvedValue(json({ tracks: songs('a'), hasMore: false }))
    render('kugou', 'album')
    act(() => latest.search('  a b&c  '))
    await flush()

    const url = urlOf(0)
    expect(url.pathname).toBe('/api/music/search')
    expect(url.searchParams.get('source')).toBe('kugou')
    expect(url.searchParams.get('type')).toBe('album')
    expect(url.searchParams.get('keyword')).toBe('a b&c')
    expect(url.searchParams.get('page')).toBe('1')
    expect(transport.fetch.mock.calls[0][1]).toMatchObject({ credentials: 'include' })
    expect(latest.results).toEqual(songs('a'))
    expect(latest.hasSearched).toBe(true)
    expect(latest.loading).toBe(false)
  })

  it('does nothing for a blank keyword', async () => {
    act(() => latest.search('   '))
    await flush()
    expect(transport.fetch).not.toHaveBeenCalled()
    expect(latest.hasSearched).toBe(false)
  })

  it('guesses there is more when the server does not say, by whether the page was full', async () => {
    transport.fetch.mockResolvedValueOnce(json({ tracks: songs(...Array.from({ length: 20 }, (_, i) => `s${i}`)) }))
    act(() => latest.search('x'))
    await flush()
    expect(latest.hasMore).toBe(true)

    transport.fetch.mockResolvedValueOnce(json({ tracks: songs('only') }))
    act(() => latest.search('y'))
    await flush()
    expect(latest.hasMore).toBe(false)
  })

  it('loads the next page of the same keyword and appends it', async () => {
    transport.fetch.mockResolvedValueOnce(json({ tracks: songs('a'), hasMore: true }))
    act(() => latest.search('x'))
    await flush()

    transport.fetch.mockResolvedValueOnce(json({ tracks: songs('b'), hasMore: false }))
    act(() => latest.loadMore())
    await flush()

    expect(urlOf(1).searchParams.get('keyword')).toBe('x')
    expect(urlOf(1).searchParams.get('page')).toBe('2')
    expect(latest.results).toEqual(songs('a', 'b'))
    expect(latest.page).toBe(2)
    expect(latest.hasMore).toBe(false)
    expect(latest.loadingMore).toBe(false)
  })

  it('shows an empty list and says so when a search fails', async () => {
    transport.fetch.mockResolvedValue(json({}, 500))
    act(() => latest.search('x'))
    await flush()
    expect(toast.error).toHaveBeenCalledWith('搜索失败，请重试')
    expect(latest.results).toEqual([])
    expect(latest.hasMore).toBe(false)
    expect(latest.loading).toBe(false)
  })

  it('keeps what is shown when loading the next page fails', async () => {
    transport.fetch.mockResolvedValueOnce(json({ tracks: songs('a'), hasMore: true }))
    act(() => latest.search('x'))
    await flush()

    transport.fetch.mockResolvedValueOnce(json({}, 500))
    act(() => latest.loadMore())
    await flush()

    expect(toast.error).toHaveBeenCalledWith('加载失败，请重试')
    expect(latest.results).toEqual(songs('a'))
    expect(latest.loadingMore).toBe(false)
  })

  it('shows only the latest search when an older one answers last', async () => {
    const first = deferred()
    const second = deferred()
    transport.fetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    act(() => latest.search('old'))
    act(() => latest.search('new'))
    expect(transport.fetch.mock.calls[0][1].signal.aborted).toBe(true)

    await act(async () => second.resolve(json({ tracks: songs('new'), hasMore: false })))
    await act(async () => first.resolve(json({ tracks: songs('old'), hasMore: false })))

    expect(latest.results).toEqual(songs('new'))
    expect(latest.loading).toBe(false)
  })

  it('clears loadingMore when a new search cancels a pending next-page request, so load more works again', async () => {
    transport.fetch.mockResolvedValueOnce(json({ tracks: songs('a'), hasMore: true }))
    act(() => latest.search('old'))
    await flush()

    const pendingMore = deferred()
    transport.fetch.mockReturnValueOnce(pendingMore.promise)
    act(() => latest.loadMore())
    expect(latest.loadingMore).toBe(true)

    transport.fetch.mockResolvedValueOnce(json({ tracks: songs('n1'), hasMore: true }))
    act(() => latest.search('new'))
    expect(transport.fetch.mock.calls[1][1].signal.aborted).toBe(true)
    expect(latest.loadingMore).toBe(false)

    await flush()
    // The cancelled request settling late must not resurrect or leak any state.
    await act(async () => pendingMore.reject(new DOMException('aborted', 'AbortError')))
    expect(latest.loadingMore).toBe(false)
    expect(latest.results).toEqual(songs('n1'))

    transport.fetch.mockResolvedValueOnce(json({ tracks: songs('n2'), hasMore: false }))
    act(() => latest.loadMore())
    await flush()
    expect(urlOf(3).searchParams.get('keyword')).toBe('new')
    expect(urlOf(3).searchParams.get('page')).toBe('2')
    expect(latest.results).toEqual(songs('n1', 'n2'))
  })

  it('is quiet about a search that was cancelled', async () => {
    transport.fetch.mockRejectedValue(new DOMException('aborted', 'AbortError'))
    act(() => latest.search('x'))
    await flush()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('drops a page that arrives after the search was reset', async () => {
    const pending = deferred()
    transport.fetch.mockReturnValueOnce(pending.promise)
    act(() => latest.search('x'))
    act(() => latest.resetState())
    await act(async () => pending.resolve(json({ tracks: songs('late'), hasMore: true })))

    expect(latest.results).toEqual([])
    expect(latest.hasSearched).toBe(false)
    expect(latest.hasMore).toBe(false)
    expect(latest.loading).toBe(false)
  })

  it('cancels a request still in flight when the component goes away', () => {
    transport.fetch.mockReturnValueOnce(deferred().promise)
    act(() => latest.search('x'))
    const { signal } = transport.fetch.mock.calls[0][1]
    act(() => root.unmount())
    expect(signal.aborted).toBe(true)
    // afterEach unmounts again: render a fresh tree so that is harmless.
    root = createRoot(container)
    render()
  })
})
