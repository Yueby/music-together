// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VoteState } from '@music-together/shared'

const motionState = vi.hoisted(() => ({
  reducedMotion: false,
}))

vi.mock('motion/react', () => ({
  useReducedMotion: () => motionState.reducedMotion,
  m: {
    div: ({
      children,
      className,
      style,
      ...rest
    }: {
      children?: React.ReactNode
      className?: string
      style?: React.CSSProperties
      [key: string]: unknown
    }) => (
      <div
        className={className}
        style={style}
        data-testid={rest['data-testid'] as string | undefined}
        data-reduced-motion={rest['data-reduced-motion'] as string | undefined}
      >
        {children}
      </div>
    ),
  },
}))

vi.mock('@/lib/storage', () => ({
  storage: {
    getUserId: () => 'user-me',
  },
}))

import { VoteBanner } from './VoteBanner'

function makeVote(overrides: Partial<VoteState> = {}): VoteState {
  return {
    id: 'vote-1',
    action: 'next',
    initiatorId: 'user-other',
    initiatorNickname: 'Alice',
    votes: { 'user-other': true },
    requiredVotes: 2,
    totalUsers: 3,
    expiresAt: Date.now() + 15_000,
    ...overrides,
  }
}

describe('VoteBanner', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    motionState.reducedMotion = false
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('uses a GPU-accelerated scaleX countdown bar with zero setInterval polling', () => {
    const intervalSpy = vi.spyOn(globalThis, 'setInterval')
    const onCastVote = vi.fn()

    act(() => {
      root.render(<VoteBanner vote={makeVote()} onCastVote={onCastVote} />)
    })

    expect(intervalSpy).not.toHaveBeenCalled()
    const bar = container.querySelector('[data-testid="vote-countdown-bar"]')
    expect(bar).not.toBeNull()
    expect(bar?.className).toContain('origin-left')
    expect(bar?.className).toContain('will-change-transform')

    const approveBtn = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('赞成'))
    const rejectBtn = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('反对'))
    expect(approveBtn).toBeDefined()
    expect(rejectBtn).toBeDefined()

    act(() => approveBtn!.click())
    expect(onCastVote).toHaveBeenCalledExactlyOnceWith(true)
  })

  it('renders a static reduced-motion countdown bar when prefers-reduced-motion is enabled', () => {
    motionState.reducedMotion = true

    act(() => {
      root.render(<VoteBanner vote={makeVote({ votes: { 'user-me': true } })} onCastVote={vi.fn()} />)
    })

    const bar = container.querySelector('[data-testid="vote-countdown-bar"]')
    expect(bar?.getAttribute('data-reduced-motion')).toBe('true')
    expect(container.textContent).toContain('已投票')
  })
})
