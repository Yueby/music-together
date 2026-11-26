// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { EVENTS } from '@music-together/shared'
import { toast } from 'sonner'
import { useRoomStore } from '@/stores/roomStore'
import { useChat } from './useChat'

const socket = vi.hoisted(() => ({ connected: true, emit: vi.fn() }))
vi.mock('@/providers/SocketProvider', () => ({ useSocketContext: () => ({ socket }) }))
vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn() } }))

it('blocks chat while disconnected and until room re-entry is confirmed', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const container = document.createElement('div')
  const root = createRoot(container)
  function Harness() {
    const { sendMessage } = useChat()
    return <button onClick={() => sendMessage(' hello ')}>Send</button>
  }

  try {
    await act(async () => root.render(<Harness />))
    const send = () => container.querySelector('button')!.click()

    socket.connected = false
    send()
    socket.connected = true
    useRoomStore.getState().setConnectionStatus('reconnecting')
    send()
    expect(socket.emit).not.toHaveBeenCalled()
    expect(toast.info).toHaveBeenCalledTimes(2)
    expect(toast.info).toHaveBeenLastCalledWith('重连中，暂无法发送消息')

    useRoomStore.getState().setConnectionStatus('connected')
    send()
    expect(socket.emit).toHaveBeenCalledExactlyOnceWith(EVENTS.CHAT_MESSAGE, { content: 'hello' })
  } finally {
    await act(async () => root.unmount())
    useRoomStore.getState().reset()
    socket.connected = true
    vi.unstubAllGlobals()
  }
})
