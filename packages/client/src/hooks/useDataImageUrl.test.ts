// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { useDataImageUrl } from './useDataImageUrl'

function DataImage({ dataUrl }: { dataUrl: string }) {
  return createElement('img', { src: useDataImageUrl(dataUrl) })
}

afterEach(() => vi.unstubAllGlobals())

it('revokes each Blob URL after StrictMode replay, image replacement, and unmount', () => {
  const createObjectURL = vi.fn()
    .mockReturnValueOnce('blob:replayed')
    .mockReturnValueOnce('blob:initial')
    .mockReturnValueOnce('blob:replacement')
  const revokeObjectURL = vi.fn()
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = createObjectURL
    static revokeObjectURL = revokeObjectURL
  })
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const container = document.createElement('div')
  const root = createRoot(container)
  const show = (dataUrl: string) => {
    act(() => root.render(createElement(StrictMode, undefined, createElement(DataImage, { dataUrl }))))
  }

  try {
    show('data:image/png;base64,AA==')
    expect(container.querySelector('img')?.getAttribute('src')).toBe('blob:initial')
    expect(revokeObjectURL.mock.calls).toEqual([['blob:replayed']])

    show('data:image/png;base64,AQ==')
    expect(container.querySelector('img')?.getAttribute('src')).toBe('blob:replacement')
    expect(revokeObjectURL.mock.calls).toEqual([['blob:replayed'], ['blob:initial']])
  } finally {
    act(() => root.unmount())
  }

  expect(createObjectURL).toHaveBeenCalledTimes(3)
  expect(revokeObjectURL.mock.calls).toEqual([['blob:replayed'], ['blob:initial'], ['blob:replacement']])
})
