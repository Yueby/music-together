import { useState, useRef, useEffect } from 'react'
import type { Socket } from 'socket.io-client'
import { MessageSquare, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChatMessage } from './ChatMessage'
import { useChatStore } from '@/stores/chatStore'
import { useRoomStore } from '@/stores/roomStore'
import { EVENTS, type ChatMessage as ChatMessageType } from '@music-together/shared'

interface ChatPanelProps {
  socket: Socket
}

export function ChatPanel({ socket }: ChatPanelProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { messages, addMessage, setMessages } = useChatStore()
  const currentUser = useRoomStore((s) => s.currentUser)

  // Listen for incoming messages
  useEffect(() => {
    const handler = (message: ChatMessageType) => {
      addMessage(message)
    }
    socket.on(EVENTS.CHAT_MESSAGE, handler)
    return () => {
      socket.off(EVENTS.CHAT_MESSAGE, handler)
    }
  }, [socket, addMessage])

  // Listen for chat history (received on room join)
  useEffect(() => {
    const handler = (history: ChatMessageType[]) => {
      setMessages(history)
    }
    socket.on(EVENTS.CHAT_HISTORY, handler)
    return () => {
      socket.off(EVENTS.CHAT_HISTORY, handler)
    }
  }, [socket, setMessages])

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleSend = () => {
    if (!input.trim()) return
    socket.emit(EVENTS.CHAT_MESSAGE, { content: input.trim() })
    setInput('')
  }

  return (
    <div className="flex h-full w-full flex-col border-l bg-card">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
        <MessageSquare className="h-4 w-4" />
        <span className="text-sm font-medium">聊天</span>
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        <div className="py-4">
          {messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              还没有消息，开始聊天吧~
            </p>
          ) : (
            messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                isOwnMessage={msg.userId === currentUser?.id}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex shrink-0 gap-2 border-t px-4 py-3">
        <Input
          placeholder="输入消息..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="flex-1"
        />
        <Button size="icon" onClick={handleSend} disabled={!input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
