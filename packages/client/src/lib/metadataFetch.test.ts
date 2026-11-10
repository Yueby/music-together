import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MetadataRequestInit } from './MetadataTransport'

const nativeFetch = vi.fn<typeof fetch>()
beforeEach(() => {
  nativeFetch.mockReset()
  vi.stubGlobal('fetch', nativeFetch)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('default Web metadata transport', () => {
  it('imports without making a request or replacing global fetch', async () => {
    vi.resetModules()
    const { metadataFetch } = await import('./metadataFetch')
    expect(metadataFetch).toBeTypeOf('function')
    expect(nativeFetch).not.toHaveBeenCalled()
    expect(globalThis.fetch).toBe(nativeFetch)
  })

  it.each([
    '/api/music/search?source=netease&keyword=fixture',
    'https://web.example/api/music/lyric?source=tencent&lyricId=fixture',
    'https://lyrics.example/fixture.ttml',
  ])('forwards the original URL, init, signal and credentials: %s', async (url) => {
    const { metadataFetch } = await import('./metadataFetch')
    const response = new Response('{"fixture":true}', { status: 200 })
    nativeFetch.mockResolvedValueOnce(response)
    const signal = new AbortController().signal
    const init: MetadataRequestInit = { signal, credentials: 'include', method: 'GET' }
    const result = await metadataFetch(url, init)
    expect(nativeFetch).toHaveBeenCalledExactlyOnceWith(url, init)
    expect(nativeFetch.mock.calls[0][1]).toBe(init)
    expect(nativeFetch.mock.calls[0][1]?.signal).toBe(signal)
    expect(nativeFetch.mock.calls[0][1]?.credentials).toBe('include')
    expect(result).toBe(response)
  })

  it('preserves an omitted init and the original non-OK Response reference', async () => {
    const { metadataFetch } = await import('./metadataFetch')
    const response = new Response('{"error":"fixture"}', { status: 503 })
    nativeFetch.mockResolvedValueOnce(response)
    expect(await metadataFetch('/api/music/search?source=netease&keyword=fixture')).toBe(response)
    expect(nativeFetch).toHaveBeenCalledExactlyOnceWith('/api/music/search?source=netease&keyword=fixture', undefined)
  })

  it('propagates the original native fetch rejection', async () => {
    const { metadataFetch } = await import('./metadataFetch')
    const error = new DOMException('fixture cancelled', 'AbortError')
    nativeFetch.mockRejectedValueOnce(error)
    await expect(metadataFetch('/fixture')).rejects.toBe(error)
  })
})
