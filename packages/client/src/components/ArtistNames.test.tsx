// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useArtistPageStore } from '@/stores/artistPageStore'
import { ArtistNames } from './ArtistNames'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  useArtistPageStore.getState().close()
  vi.unstubAllGlobals()
})

const names = () => [...container.querySelectorAll('button')]

describe('ArtistNames', () => {
  it('shows "A / B" with each name opening that artist page, by id when the track knows it', () => {
    act(() => root.render(<ArtistNames track={{ source: 'netease', artist: ['A', 'B'], artistIds: ['1', '2'] }} />))
    expect(container.textContent).toBe('A / B')
    act(() => names()[1].click())
    expect(useArtistPageStore.getState().target).toEqual({ source: 'netease', id: '2', name: 'B' })
  })

  it('opens an artist known only by name without an id', () => {
    act(() => root.render(<ArtistNames track={{ source: 'netease', artist: ['A'] }} />))
    act(() => names()[0].click())
    expect(useArtistPageStore.getState().target).toEqual({ source: 'netease', name: 'A' })
  })

  it('does not trigger the row the name sits in', () => {
    const onRow = vi.fn()
    act(() =>
      root.render(
        <div onClick={onRow}>
          <ArtistNames track={{ source: 'netease', artist: ['A'] }} />
        </div>,
      ),
    )
    act(() => names()[0].click())
    expect(onRow).not.toHaveBeenCalled()
  })

  it('does not link the placeholder for "nobody credited", on any platform', () => {
    const onUnsupportedClick = vi.fn()
    act(() => root.render(<ArtistNames track={{ source: 'netease', artist: ['Unknown'] }} />))
    expect(names()).toHaveLength(0)
    act(() =>
      root.render(
        <ArtistNames track={{ source: 'tencent', artist: ['Unknown'] }} onUnsupportedClick={onUnsupportedClick} />,
      ),
    )
    expect(names()).toHaveLength(0)
    expect(container.textContent).toBe('Unknown')
  })

  it('is plain text where the platform has no artist pages, unless the caller says what a click does', () => {
    act(() => root.render(<ArtistNames track={{ source: 'tencent', artist: ['A', 'B'] }} />))
    expect(names()).toHaveLength(0)
    expect(container.textContent).toBe('A / B')

    const onUnsupportedClick = vi.fn()
    act(() =>
      root.render(<ArtistNames track={{ source: 'tencent', artist: ['A'] }} onUnsupportedClick={onUnsupportedClick} />),
    )
    act(() => names()[0].click())
    expect(onUnsupportedClick).toHaveBeenCalledExactlyOnceWith('A')
    expect(useArtistPageStore.getState().target).toBeNull()
  })
})
