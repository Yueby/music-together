// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const searchMock = vi.hoisted(() => ({
  search: vi.fn(),
  loadMore: vi.fn(),
  resetState: vi.fn(),
}))

vi.mock('@/hooks/useSearch', () => ({
  useSearch: () => ({
    results: [],
    loading: false,
    loadingMore: false,
    hasMore: false,
    hasSearched: false,
    search: searchMock.search,
    loadMore: searchMock.loadMore,
    resetState: searchMock.resetState,
  }),
}))

vi.mock('@/hooks/usePlaylist', () => ({
  usePlaylist: () => ({
    playlistTracks: [],
    playlistTotal: 0,
    tracksLoading: false,
    loadingMore: false,
    hasMoreTracks: false,
    fetchPlaylistTracks: vi.fn(),
    loadMoreTracks: vi.fn(),
  }),
}))

vi.mock('@/hooks/useQueueMembership', () => ({
  useQueueMembership: () => ({
    isAdded: () => false,
    markPending: vi.fn(),
    addOnce: vi.fn(),
  }),
}))

vi.mock('@/providers/SocketProvider', () => ({
  useSocketContext: () => ({ socket: { connected: true, emit: vi.fn() } }),
}))

vi.mock('@/components/ui/responsive-dialog', () => ({
  DIALOG_BODY_CLASS: '',
  ResponsiveDialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
  ResponsiveDialogContent: ({ className, children }: { className?: string; children: ReactNode }) => (
    <div data-testid="search-dialog-content" className={className}>
      {children}
    </div>
  ),
  ResponsiveDialogBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/DialogNav', () => ({
  DialogNavBar: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogPageTransition: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/PlatformSelect', () => ({
  PlatformSelect: () => <div data-testid="platform-select" />,
}))

vi.mock('@/components/VirtualTrackList', () => ({
  VirtualTrackList: () => <div data-testid="virtual-track-list" />,
}))

vi.mock('@/components/Pages/PlaylistPage', () => ({
  PlaylistPage: () => null,
}))

import { SearchDialog } from './SearchDialog'

describe('SearchDialog', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    searchMock.search.mockClear()
    searchMock.resetState.mockClear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => {
      root.render(
        <SearchDialog
          open
          onOpenChange={vi.fn()}
          onAddToQueue={vi.fn()}
          onInsertAfterCurrent={vi.fn()}
        />,
      )
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  function typeKeyword(text: string) {
    const input = container.querySelector<HTMLInputElement>('input[aria-label="搜索关键词"]')!
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    act(() => {
      setter.call(input, text)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    return input
  }

  it('guards Enter submission during IME composition and submits on regular Enter', () => {
    const input = typeKeyword('周杰伦')

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }))
    })
    expect(searchMock.search).not.toHaveBeenCalled()

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true }))
    })
    expect(searchMock.search).not.toHaveBeenCalled()

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: false, bubbles: true }))
    })
    expect(searchMock.search).toHaveBeenCalledExactlyOnceWith('周杰伦')
  })

  it('shows a clear button when keyword is non-empty and clears the input on click', () => {
    expect(container.querySelector('button[aria-label="清空搜索关键词"]')).toBeNull()

    const input = typeKeyword('晴天')
    const clearBtn = container.querySelector<HTMLButtonElement>('button[aria-label="清空搜索关键词"]')
    expect(clearBtn).not.toBeNull()

    act(() => clearBtn!.click())
    expect(input.value).toBe('')
    expect(container.querySelector('button[aria-label="清空搜索关键词"]')).toBeNull()
  })

  it('uses a stable desktop height without jumping from a compact initial height', () => {
    const content = container.querySelector('[data-testid="search-dialog-content"]')
    expect(content?.className).toContain('h-[calc(var(--app-dvh)*0.7)]')
    expect(content?.className).not.toContain('sm:h-[25rem]')
  })
})
