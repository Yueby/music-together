// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sendMessage = vi.fn()
vi.hoisted(() => {
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never
})
vi.mock('@/hooks/useChat', () => ({ useChat: () => ({ sendMessage }) }))

import { TooltipProvider } from '@/components/ui/tooltip'
import { ChatPanel } from './ChatPanel'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  Element.prototype.scrollIntoView = vi.fn()
  sendMessage.mockClear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() =>
    root.render(
      <TooltipProvider>
        <ChatPanel />
      </TooltipProvider>,
    ),
  )
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

function type(text: string) {
  const input = container.querySelector('input') as HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setter.call(input, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  return input
}

function pressEnter(input: HTMLInputElement, isComposing: boolean) {
  act(() => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing, bubbles: true }))
  })
}

describe('ChatPanel input', () => {
  it('sends on Enter', () => {
    pressEnter(type('你好'), false)
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith('你好')
  })

  it('does not send when Enter only confirms an IME candidate', () => {
    pressEnter(type('nihao'), true)
    expect(sendMessage).not.toHaveBeenCalled()
  })
})
