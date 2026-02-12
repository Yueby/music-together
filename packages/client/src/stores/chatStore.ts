import { create } from 'zustand'
import type { ChatMessage } from '@music-together/shared'

const DEFAULT_CHAT_WIDTH = 350

interface ChatStore {
  messages: ChatMessage[]
  unreadCount: number
  chatWidth: number

  addMessage: (message: ChatMessage) => void
  setMessages: (messages: ChatMessage[]) => void
  setChatWidth: (width: number | ((prev: number) => number)) => void
  incrementUnread: () => void
  clearUnread: () => void
  reset: () => void
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  unreadCount: 0,
  chatWidth: DEFAULT_CHAT_WIDTH,

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
      unreadCount: state.chatWidth > 0 ? state.unreadCount : state.unreadCount + 1,
    })),
  setMessages: (messages) => set({ messages }),
  setChatWidth: (width) =>
    set((state) => {
      const newWidth = typeof width === 'function' ? width(state.chatWidth) : width
      return {
        chatWidth: newWidth,
        unreadCount: newWidth > 0 && state.chatWidth === 0 ? 0 : state.unreadCount,
      }
    }),
  incrementUnread: () =>
    set((state) => ({ unreadCount: state.unreadCount + 1 })),
  clearUnread: () => set({ unreadCount: 0 }),
  reset: () => set({ messages: [], unreadCount: 0 }),
}))

export { DEFAULT_CHAT_WIDTH }
