import type { ChatMessage, User } from '@music-together/shared'
import { chatRepo } from '../repositories/chatRepository.js'

/** 创建用户聊天消息（客户端用 React 文本渲染，天然防 XSS，无需服务端转义） */
export function createMessage(roomId: string, user: User, content: string): ChatMessage {
  const message: ChatMessage = {
    id: crypto.randomUUID(),
    userId: user.id,
    nickname: user.nickname,
    content: content.trim(),
    timestamp: Date.now(),
    type: 'user',
  }

  chatRepo.addMessage(roomId, message)
  return message
}

/** 创建系统消息 */
export function createSystemMessage(roomId: string, content: string): ChatMessage {
  const message: ChatMessage = {
    id: crypto.randomUUID(),
    userId: 'system',
    nickname: 'system',
    content,
    timestamp: Date.now(),
    type: 'system',
  }

  chatRepo.addMessage(roomId, message)
  return message
}

export function getHistory(roomId: string): ChatMessage[] {
  return chatRepo.getHistory(roomId)
}
