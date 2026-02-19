import type { ChatMessage, User } from '@music-together/shared'
import escapeHtml from 'escape-html'
import { chatRepo } from '../repositories/chatRepository.js'

/** 创建用户聊天消息，含 HTML 转义 */
export function createMessage(roomId: string, user: User, content: string): ChatMessage {
  const message: ChatMessage = {
    id: crypto.randomUUID(),
    userId: user.id,
    nickname: user.nickname,
    content: escapeHtml(content.trim()),
    timestamp: Date.now(),
    type: 'user',
  }

  chatRepo.addMessage(roomId, message)
  return message
}

/** 创建系统消息（内容也做 HTML 转义，防止用户昵称 / 歌曲名注入） */
export function createSystemMessage(roomId: string, content: string): ChatMessage {
  const message: ChatMessage = {
    id: crypto.randomUUID(),
    userId: 'system',
    nickname: 'system',
    content: escapeHtml(content),
    timestamp: Date.now(),
    type: 'system',
  }

  chatRepo.addMessage(roomId, message)
  return message
}

export function getHistory(roomId: string): ChatMessage[] {
  return chatRepo.getHistory(roomId)
}
