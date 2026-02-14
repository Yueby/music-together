import type { ChatMessage } from '@music-together/shared'
import { LIMITS } from '@music-together/shared'
import { create } from 'zustand'

interface ChatStore {
  messages: ChatMessage[]
  unreadCount: number
  isChatOpen: boolean

  addMessage: (message: ChatMessage) => void
  setMessages: (messages: ChatMessage[]) => void
  setIsChatOpen: (open: boolean) => void
  clearUnread: () => void
  reset: () => void
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  unreadCount: 0,
  isChatOpen: false,

  addMessage: (message) =>
    set((state) => {
      const next = [...state.messages, message]
      return {
        messages: next.length > LIMITS.CHAT_HISTORY_MAX
          ? next.slice(-LIMITS.CHAT_HISTORY_MAX)
          : next,
        unreadCount: state.isChatOpen || message.type === 'system'
          ? state.unreadCount
          : state.unreadCount + 1,
      }
    }),
  setMessages: (messages) => set({ messages }),
  setIsChatOpen: (open) =>
    set((state) => ({
      isChatOpen: open,
      // Auto-clear unread when opening from closed state
      unreadCount: open && !state.isChatOpen ? 0 : state.unreadCount,
    })),
  clearUnread: () => set({ unreadCount: 0 }),
  reset: () => set({ messages: [], unreadCount: 0, isChatOpen: false }),
}))
