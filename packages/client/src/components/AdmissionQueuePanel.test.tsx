// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdmissionQueuedEvent } from '@music-together/shared'
import { AdmissionQueueCard, AdmissionQueueDialog } from './AdmissionQueuePanel'

const queuedSample: AdmissionQueuedEvent = {
  position: 3,
  queueLength: 12,
  action: 'join',
  roomId: 'ROOM01',
  reason: 'capacity',
  capacity: {
    level: 'full',
    mappLevel: 'full',
    onlineUsers: 80,
    activeRooms: 10,
    usedUnits: 105,
    effectiveCap: 105,
    estimatedWebRemaining: 0,
    estimatedMappRemaining: 0,
    queueLength: 12,
    maxQueueLength: 100,
    pressurePercent: 92,
    createRestricted: true,
    updatedAt: 1_000,
  },
}

const CJK_RE = /[\u4e00-\u9fff]/

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('AdmissionQueueCard', () => {
  it('displays queue position, target room, load percentage, and invokes onCancel', () => {
    const onCancel = vi.fn()
    act(() => root.render(<AdmissionQueueCard queued={queuedSample} onCancel={onCancel} />))

    const text = container.textContent ?? ''
    expect(text).toContain('服务器满载，正在排队')
    expect(text).toContain('第 3 位')
    expect(text).toContain('前方 2 人')
    expect(text).toContain('共 12 人')
    expect(text).toContain('加入房间')
    expect(text).toContain('ROOM01')
    expect(text).toContain('服务器负载')
    expect(text).toContain('92%')
    expect(text).not.toContain('当前 80 人在线')

    // No Chinese characters should ever inherit font-mono (avoids SimSun fallback on Windows)
    const monoNodes = [...container.querySelectorAll('.font-mono')]
    expect(monoNodes.map((n) => n.textContent)).toEqual(['ROOM01'])
    for (const el of monoNodes) {
      expect(CJK_RE.test(el.textContent ?? '')).toBe(false)
    }

    // No off-system animate-ping rings
    expect(container.querySelector('.animate-ping')).toBeNull()

    const button = container.querySelector<HTMLButtonElement>('button')
    expect(button).not.toBeNull()
    act(() => button!.click())
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('shows a single concise next-in-line label without duplicate copy when position reaches 1', () => {
    act(() =>
      root.render(<AdmissionQueueCard queued={{ ...queuedSample, position: 1, queueLength: 5 }} onCancel={vi.fn()} />),
    )

    const text = container.textContent ?? ''
    expect(text).toContain('第 1 位')
    expect(text).toContain('你是下一位')
    expect(text).not.toContain('即将进入')
  })

  it('shows natural mini-app stream congestion copy when reason is mapp_stream', () => {
    act(() =>
      root.render(
        <AdmissionQueueCard
          queued={{ ...queuedSample, reason: 'mapp_stream', action: 'create', roomId: undefined }}
          onCancel={vi.fn()}
        />,
      ),
    )

    const text = container.textContent ?? ''
    expect(text).toContain('音频中转繁忙，正在排队')
    expect(text).toContain('创建新房间')
    expect(text).toContain('有空位后会自动为你进入')
    expect(text).not.toContain('槽位')
  })
})

describe('AdmissionQueueDialog', () => {
  it('renders tight responsive dialog with queue details and cancel button', () => {
    const onCancel = vi.fn()
    act(() => root.render(<AdmissionQueueDialog queued={queuedSample} onCancel={onCancel} />))

    const dialog = document.body.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    const text = dialog?.textContent ?? ''
    expect(text).toContain('服务器满载，正在排队')
    expect(text).not.toContain('当前 80 人在线')
    expect(text).toContain('第 3 位')
    expect(text).toContain('共 12 人')
    expect(text).toContain('加入房间')
    expect(text).toContain('ROOM01')

    for (const el of dialog?.querySelectorAll('.font-mono') ?? []) {
      expect(CJK_RE.test(el.textContent ?? '')).toBe(false)
    }

    const cancelBtn = [...(dialog?.querySelectorAll('button') ?? [])].find((b) => b.textContent?.includes('取消排队'))
    expect(cancelBtn).toBeDefined()
    act(() => cancelBtn!.click())
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
