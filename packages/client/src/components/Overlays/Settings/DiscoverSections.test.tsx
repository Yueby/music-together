// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/hooks/useArtworkUrl', () => ({ useArtworkUrl: (url?: string) => url }))

import { CoverSection } from './DiscoverSections'

const noop = () => {}

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
  vi.unstubAllGlobals()
})

describe('CoverSection', () => {
  interface Item {
    id: string
    name: string
  }
  const render = (props: Partial<Parameters<typeof CoverSection<Item>>[0]> = {}) =>
    act(() =>
      root.render(
        <CoverSection<Item>
          platform="netease"
          title="歌手推荐"
          subtitle="热门歌手"
          items={[{ id: '1', name: '歌手甲' }]}
          loading={false}
          error={null}
          onRetry={noop}
          describe={(item) => ({ title: item.name, subtitle: '40 首歌曲' })}
          fallback={<span>icon</span>}
          onSelect={noop}
          {...props}
        />,
      ),
    )
  const button = (label: string) =>
    [...container.querySelectorAll('button')].find((candidate) => candidate.textContent?.includes(label))

  it('shows the tiles and reports the chosen one', () => {
    const onSelect = vi.fn()
    render({ onSelect })
    expect(container.textContent).toContain('歌手推荐')
    expect(container.textContent).toContain('40 首歌曲')
    act(() => container.querySelector<HTMLButtonElement>('button')!.click())
    expect(onSelect).toHaveBeenCalledExactlyOnceWith({ id: '1', name: '歌手甲' })
  })

  it('renders round artwork for people', () => {
    render({ round: true })
    expect(container.querySelector('.rounded-full')).not.toBeNull()
  })

  it('names the problem instead of showing nothing', () => {
    render({ items: [], error: 'unsupported', platform: 'kugou' })
    expect(container.textContent).toContain('酷狗音乐暂不提供歌手推荐')
    render({ items: [], error: null })
    expect(container.textContent).toContain('暂无内容')
  })

  it.each([
    ['login-required', '登录网易云音乐后查看歌手推荐', false],
    ['failed', '歌手推荐加载失败', true],
  ] as const)('explains %s, and offers a retry only where retrying helps', (error, message, retry) => {
    render({ items: [], error })
    expect(container.textContent).toContain(message)
    expect(!!button('重试')).toBe(retry)
  })
})
