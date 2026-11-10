// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Track } from '@music-together/shared'
import type { HostRuntime } from '@/lib/hostRuntime'

const runtimeState: { -readonly [Key in keyof HostRuntime]: HostRuntime[Key] } = {
  kind: 'web',
  platformAccounts: true,
  collections: true,
  nativeMediaSession: true,
  versionCheck: true,
  remoteArtwork: true,
  clipboard: true,
  externalLinks: true,
}

vi.mock('@/lib/hostRuntime', () => ({
  hostRuntime: new Proxy({} as HostRuntime, {
    get: (_target, prop: keyof HostRuntime) => runtimeState[prop],
  }),
}))

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

describe('hostRuntime remoteArtwork UI isolation', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
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

  describe('TrackListItem', () => {
    it('renders remote cover image when remoteArtwork is true (Web)', () => {
      runtimeState.remoteArtwork = true

      act(() => {
        root.render(
          <TrackListItem
            track={mockTrackState.currentTrack!}
            index={0}
            isAdded={false}
            onAdd={vi.fn()}
          />,
        )
      })

      const img = container.querySelector('img')
      expect(img).not.toBeNull()
      expect(img?.getAttribute('src')).toBe('https://example.com/thumbnail.jpg')
    })

    it('does not render img and uses fallback when remoteArtwork is false (Mapp)', () => {
      runtimeState.remoteArtwork = false

      act(() => {
        root.render(
          <TrackListItem
            track={mockTrackState.currentTrack!}
            index={0}
            isAdded={false}
            onAdd={vi.fn()}
          />,
        )
      })

      const img = container.querySelector('img')
      expect(img).toBeNull()
      // Fallback music icon container should exist
      const fallback = container.querySelector('.bg-muted')
      expect(fallback).not.toBeNull()
    })
  })

  describe('NowPlaying', () => {
    it('renders remote cover image when remoteArtwork is true (Web)', () => {
      runtimeState.remoteArtwork = true

      act(() => {
        root.render(<NowPlaying />)
      })

      const img = container.querySelector('img')
      expect(img).not.toBeNull()
      expect(img?.getAttribute('src')).toBe('https://example.com/cover.jpg')
    })

    it('does not render img and uses Disc3 fallback when remoteArtwork is false (Mapp)', () => {
      runtimeState.remoteArtwork = false

      act(() => {
        root.render(<NowPlaying />)
      })

      const img = container.querySelector('img')
      expect(img).toBeNull()
      // Fallback secondary container with Disc3 should exist
      const fallback = container.querySelector('.bg-secondary')
      expect(fallback).not.toBeNull()
    })
  })
})
