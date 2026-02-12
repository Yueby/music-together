import type { ChatMessage } from '@music-together/shared'
import { LIMITS } from '@music-together/shared'
import type { ChatRepository } from './types.js'

export class InMemoryChatRepository implements ChatRepository {
  private history = new Map<string, ChatMessage[]>()

  getHistory(roomId: string): ChatMessage[] {
    return this.history.get(roomId) ?? []
  }

  addMessage(roomId: string, message: ChatMessage): void {
    const messages = this.history.get(roomId)
    if (!messages) return
    messages.push(message)
    if (messages.length > LIMITS.CHAT_HISTORY_MAX) {
      messages.splice(0, messages.length - LIMITS.CHAT_HISTORY_MAX)
    }
  }

  createRoom(roomId: string): void {
    this.history.set(roomId, [])
  }

  deleteRoom(roomId: string): void {
    this.history.delete(roomId)
  }
}

/** Singleton instance */
export const chatRepo = new InMemoryChatRepository()
