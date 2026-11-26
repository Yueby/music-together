// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TrackListItem } from './TrackListItem'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { Track } from '@music-together/shared'

const mockTrack: Track = {
  id: 'test-1',
  title: 'Test Song',
  artist: ['Test Artist'],
  album: 'Test Album',
  duration: 200,
  cover: 'https://example.com/cover.jpg',
  thumbnailCover: 'https://example.com/thumbnail.jpg',
  source: 'netease',
  sourceId: '123',
  urlId: '123',
}

function renderComponent(ui: React.ReactNode) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

describe('TrackListItem thumbnail optimization', () => {
  it('renders thumbnailCover when provided', () => {
    const { container } = renderComponent(
      <TrackListItem
        track={mockTrack}
        index={0}
        isAdded={false}
        onAdd={vi.fn()}
      />,
    )
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img).toHaveAttribute('src', 'https://example.com/thumbnail.jpg')
  })

  it('falls back to cover when thumbnailCover is not provided', () => {
    const trackWithoutThumb = { ...mockTrack, thumbnailCover: undefined }
    const { container } = renderComponent(
      <TrackListItem
        track={trackWithoutThumb}
        index={0}
        isAdded={false}
        onAdd={vi.fn()}
      />,
    )
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img).toHaveAttribute('src', 'https://example.com/cover.jpg')
  })

  it('hides index and duration below sm breakpoint to reclaim space on 375px screens', () => {
    const { container } = renderComponent(
      <TrackListItem
        track={mockTrack}
        index={0}
        isAdded={false}
        onAdd={vi.fn()}
      />,
    )
    const indexEl = container.querySelector('[data-testid="track-index"]')
    const durationEl = container.querySelector('[data-testid="track-duration"]')
    expect(indexEl).not.toBeNull()
    expect(durationEl).not.toBeNull()
    expect(indexEl?.className).toContain('hidden')
    expect(indexEl?.className).toContain('sm:inline-block')
    expect(durationEl?.className).toContain('hidden')
    expect(durationEl?.className).toContain('sm:inline')
  })
})
