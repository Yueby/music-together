// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const loader = vi.hoisted(() => ({
  direct: true,
  load: vi.fn<(url: string, signal?: AbortSignal) => Promise<string>>(),
}))
vi.mock('@/lib/artwork', () => ({ artworkLoader: loader }))

import { useArtwork, useArtworkUrl } from './useArtworkUrl'

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
let seen: (string | undefined)[]

function Probe({ url }: { url?: string }) {
  const src = useArtworkUrl(url)
  seen.push(src)
  return <span>{src ?? 'none'}</span>
}
const render = (url?: string) => act(() => root.render(<Probe url={url} />))
const text = () => container.textContent

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  seen = []
  loader.direct = true
  loader.load.mockReset()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('useArtworkUrl (Web, direct)', () => {
  it('returns the URL on the very first render, without loading anything', () => {
    render('https://example.com/cover.jpg')
    expect(seen[0]).toBe('https://example.com/cover.jpg')
    expect(seen.every((value) => value === 'https://example.com/cover.jpg')).toBe(true)
    expect(loader.load).not.toHaveBeenCalled()
  })

  it('follows URL changes immediately and returns undefined for no URL', () => {
    render('https://example.com/a.jpg')
    render('https://example.com/b.jpg')
    expect(text()).toBe('https://example.com/b.jpg')
    render(undefined)
    expect(text()).toBe('none')
    expect(loader.load).not.toHaveBeenCalled()
  })
})

describe('useArtworkUrl (host that reads the bytes)', () => {
  beforeEach(() => {
    loader.direct = false
  })

  it('shows nothing until the image is ready, then the loaded address', async () => {
    const reply = deferred<string>()
    loader.load.mockReturnValue(reply.promise)
    render('https://example.com/a.jpg')
    expect(text()).toBe('none')
    expect(loader.load).toHaveBeenCalledWith('https://example.com/a.jpg', expect.any(AbortSignal))
    await act(async () => reply.resolve('blob:a'))
    expect(text()).toBe('blob:a')
  })

  it('never shows the previous cover for a new URL, and cancels the previous load', async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    loader.load.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    render('https://example.com/a.jpg')
    const firstSignal = loader.load.mock.calls[0][1]!
    await act(async () => first.resolve('blob:a'))
    expect(text()).toBe('blob:a')
    render('https://example.com/b.jpg')
    expect(text()).toBe('none')
    expect(firstSignal.aborted).toBe(true)
    await act(async () => second.resolve('blob:b'))
    expect(text()).toBe('blob:b')
  })

  it('ignores a late result for a URL that is no longer current', async () => {
    const stale = deferred<string>()
    const current = deferred<string>()
    loader.load.mockReturnValueOnce(stale.promise).mockReturnValueOnce(current.promise)
    render('https://example.com/a.jpg')
    render('https://example.com/b.jpg')
    await act(async () => stale.resolve('blob:stale'))
    expect(text()).toBe('none')
    await act(async () => current.resolve('blob:b'))
    expect(text()).toBe('blob:b')
  })

  it('stays on the placeholder when loading fails', async () => {
    loader.load.mockRejectedValue(new Error('ARTWORK_REQUEST_FAILED'))
    render('https://example.com/a.jpg')
    await act(async () => {})
    expect(text()).toBe('none')
  })

  it('retries once after a failure and then shows the cover; a second failure keeps the placeholder', async () => {
    vi.useFakeTimers()
    try {
      loader.load.mockRejectedValueOnce(new Error('ARTWORK_REQUEST_FAILED')).mockResolvedValueOnce('blob:retry')
      render('https://example.com/a.jpg')
      await act(async () => {})
      expect(text()).toBe('none')
      await act(async () => vi.advanceTimersByTimeAsync(2_500))
      expect(loader.load).toHaveBeenCalledTimes(2)
      expect(text()).toBe('blob:retry')

      loader.load.mockReset()
      loader.load.mockRejectedValue(new Error('ARTWORK_REQUEST_FAILED'))
      render('https://example.com/b.jpg')
      await act(async () => vi.advanceTimersByTimeAsync(10_000))
      expect(loader.load).toHaveBeenCalledTimes(2)
      expect(text()).toBe('none')
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not retry for a cover that is no longer wanted', async () => {
    vi.useFakeTimers()
    try {
      loader.load.mockRejectedValue(new Error('ARTWORK_REQUEST_FAILED'))
      render('https://example.com/a.jpg')
      await act(async () => {})
      render(undefined)
      await act(async () => vi.advanceTimersByTimeAsync(10_000))
      expect(loader.load).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })

  it('cancels the load on unmount and never loads without a URL', () => {
    loader.load.mockReturnValue(new Promise(() => {}))
    render('https://example.com/a.jpg')
    const signal = loader.load.mock.calls[0][1]!
    act(() => root.unmount())
    expect(signal.aborted).toBe(true)
    root = createRoot(container)
    loader.load.mockClear()
    render(undefined)
    expect(loader.load).not.toHaveBeenCalled()
  })
})

describe('useArtwork (whether it gave up)', () => {
  function FailedProbe({ url }: { url?: string }) {
    const { src, failed } = useArtwork(url)
    return <span>{`${src ?? 'none'}|${failed ? 'failed' : 'ok'}`}</span>
  }
  const renderFailed = (url?: string) => act(() => root.render(<FailedProbe url={url} />))

  beforeEach(() => {
    loader.direct = false
  })

  it('is not failed while loading or retrying, and becomes failed after the last attempt', async () => {
    vi.useFakeTimers()
    try {
      loader.load.mockRejectedValue(new Error('ARTWORK_REQUEST_FAILED'))
      renderFailed('https://example.com/a.jpg')
      expect(text()).toBe('none|ok')
      await act(async () => {})
      expect(text()).toBe('none|ok') // the retry is still to come
      await act(async () => vi.advanceTimersByTimeAsync(2_500))
      expect(text()).toBe('none|failed')
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not carry a failure over to the next URL, and is never failed on the web', async () => {
    vi.useFakeTimers()
    try {
      loader.load.mockRejectedValueOnce(new Error('x')).mockRejectedValueOnce(new Error('x'))
      renderFailed('https://example.com/a.jpg')
      await act(async () => vi.advanceTimersByTimeAsync(2_500))
      expect(text()).toBe('none|failed')
      loader.load.mockReturnValue(new Promise(() => {}))
      renderFailed('https://example.com/b.jpg')
      expect(text()).toBe('none|ok')
      loader.direct = true
      renderFailed('https://example.com/c.jpg')
      expect(text()).toBe('https://example.com/c.jpg|ok')
    } finally {
      vi.useRealTimers()
    }
  })
})
