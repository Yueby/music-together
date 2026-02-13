import { useSocketContext } from '@/providers/SocketProvider'
import { useChatStore } from '@/stores/chatStore'
import { EVENTS } from '@music-together/shared'
import type { ChatMessage } from '@music-together/shared'
import { useEffect } from 'react'

/** Syncs chat history and incoming messages from the server to the chat store. */
export function useChatSync() {
  const { socket } = useSocketContext()

  useEffect(() => {
    const onChatHistory = (messages: ChatMessage[]) => {
      useChatStore.getState().setMessages(messages)
    }

    const onChatMessage = (message: ChatMessage) => {
      useChatStore.getState().addMessage(message)
    }

    socket.on(EVENTS.CHAT_HISTORY, onChatHistory)
    socket.on(EVENTS.CHAT_MESSAGE, onChatMessage)

    return () => {
      socket.off(EVENTS.CHAT_HISTORY, onChatHistory)
      socket.off(EVENTS.CHAT_MESSAGE, onChatMessage)
    }
  }, [socket])
}
