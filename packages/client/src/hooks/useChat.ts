import { useCallback } from 'react'
import { EVENTS, LIMITS } from '@music-together/shared'
import { useSocketContext } from '@/providers/SocketProvider'
import { canSendRoomCommand } from '@/stores/roomStore'
import { toast } from 'sonner'

export function useChat() {
  const { socket } = useSocketContext()

  const sendMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return
      if (trimmed.length > LIMITS.CHAT_CONTENT_MAX_LENGTH) {
        toast.error(`消息不能超过 ${LIMITS.CHAT_CONTENT_MAX_LENGTH} 个字符`)
        return
      }
      if (!canSendRoomCommand(socket)) {
        toast.info('重连中，暂无法发送消息')
        return
      }
      socket.emit(EVENTS.CHAT_MESSAGE, { content: trimmed })
    },
    [socket],
  )

  return { sendMessage }
}
