// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Track } from '@music-together/shared'

const loader = vi.hoisted(() => ({
  direct: true,
  load: vi.fn<(url: string, signal?: AbortSignal) => Promise<string>>(),
}))
vi.mock('@/lib/artwork', () => ({ artworkLoader: loader }))

const mockTrackState = {
  currentTrack: {
    id: 'test-track-1',
    title: 'Test Song Title',
    artist: ['Test Artist'],
    album: 'Test Album',
    duration: 180,
    cover: 'https://example.com/cover.jpg',
    thumbnailCover: 'https://example.com/thumbnail.jpg',
    source: 'netease',
    sourceId: '123',
    urlId: '123',
  } as Track | null,
}

vi.mock('@/stores/playerStore', () => ({
  usePlayerStore: <T,>(selector: (s: typeof mockTrackState) => T): T => selector(mockTrackState),
}))

vi.mock('motion/react', () => ({
  motion: {
    div: ({
      children,
      className,
      style,
      onClick,
    }: {
      children?: React.ReactNode
      className?: string
      style?: React.CSSProperties
      onClick?: () => void
    }) => (
      <div className={className} style={style} onClick={onClick}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/ui/marquee-text', () => ({
  MarqueeText: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { TrackListItem } from './TrackListItem'
import { NowPlaying } from './Player/NowPlaying'
import { QueueCover } from './Overlays/QueueDrawer'

const track = mockTrackState.currentTrack!
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

describe('cover artwork in the shared UI', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    loader.direct = true
    loader.load.mockReset()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
    vi.unstubAllGlobals()
  })

  const renderTrackListItem = () =>
    act(() => {
      root.render(<TrackListItem track={track} index={0} isAdded={false} onAdd={vi.fn()} />)
    })

  describe('Web (direct): unchanged', () => {
    it('TrackListItem renders the thumbnail URL on the first render', () => {
      renderTrackListItem()
      expect(container.querySelector('img')?.getAttribute('src')).toBe('https://example.com/thumbnail.jpg')
      expect(loader.load).not.toHaveBeenCalled()
    })

    it('TrackListItem falls back to the full cover, then to the icon', () => {
      act(() => {
        root.render(
          <TrackListItem track={{ ...track, thumbnailCover: undefined }} index={0} isAdded={false} onAdd={vi.fn()} />,
        )
      })
      expect(container.querySelector('img')?.getAttribute('src')).toBe('https://example.com/cover.jpg')
      act(() => {
        root.render(
          <TrackListItem
            track={{ ...track, thumbnailCover: undefined, cover: '' }}
            index={0}
            isAdded={false}
            onAdd={vi.fn()}
          />,
        )
      })
      expect(container.querySelector('img')).toBeNull()
      expect(container.querySelector('.bg-muted')).not.toBeNull()
    })

    it('NowPlaying renders the cover URL on the first render', () => {
      act(() => {
        root.render(<NowPlaying />)
      })
      const img = container.querySelector('img')
      expect(img?.getAttribute('src')).toBe('https://example.com/cover.jpg')
      expect(img?.getAttribute('alt')).toBe('Test Song Title')
    })

    it('NowPlaying switches to the icon when the image fails to load', () => {
      act(() => {
        root.render(<NowPlaying />)
      })
      act(() => {
        container.querySelector('img')!.dispatchEvent(new Event('error'))
      })
      expect(container.querySelector('img')).toBeNull()
      expect(container.querySelector('.bg-secondary')).not.toBeNull()
    })

    it('QueueCover renders the thumbnail, and the icon after an image error', () => {
      act(() => {
        root.render(<QueueCover track={track} />)
      })
      const img = container.querySelector('img')
      expect(img?.getAttribute('src')).toBe('https://example.com/thumbnail.jpg')
      act(() => {
        img!.dispatchEvent(new Event('error'))
      })
      expect(container.querySelector('img')).toBeNull()
      expect(container.querySelector('.bg-muted')).not.toBeNull()
    })
  })

  describe('Mapp (bytes read through the host)', () => {
    beforeEach(() => {
      loader.direct = false
    })

    it('shows the icon first, then the loaded Blob URL (TrackListItem)', async () => {
      const reply = deferred<string>()
      loader.load.mockReturnValue(reply.promise)
      renderTrackListItem()
      expect(container.querySelector('img')).toBeNull()
      expect(container.querySelector('.bg-muted')).not.toBeNull()
      expect(loader.load).toHaveBeenCalledWith('https://example.com/thumbnail.jpg', expect.any(AbortSignal))
      await act(async () => reply.resolve('blob:thumb'))
      expect(container.querySelector('img')?.getAttribute('src')).toBe('blob:thumb')
    })

    it('shows the icon first, then the loaded Blob URL (NowPlaying) and requests the full cover', async () => {
      const reply = deferred<string>()
      loader.load.mockReturnValue(reply.promise)
      act(() => {
        root.render(<NowPlaying />)
      })
      expect(container.querySelector('img')).toBeNull()
      expect(container.querySelector('.bg-secondary')).not.toBeNull()
      expect(loader.load).toHaveBeenCalledWith('https://example.com/cover.jpg', expect.any(AbortSignal))
      await act(async () => reply.resolve('blob:cover'))
      expect(container.querySelector('img')?.getAttribute('src')).toBe('blob:cover')
    })

    it('keeps the icon when the cover cannot be loaded (QueueCover)', async () => {
      loader.load.mockRejectedValue(new Error('ARTWORK_REQUEST_FAILED'))
      act(() => {
        root.render(<QueueCover track={track} />)
      })
      await act(async () => {})
      expect(container.querySelector('img')).toBeNull()
      expect(container.querySelector('.bg-muted')).not.toBeNull()
    })
  })
})
