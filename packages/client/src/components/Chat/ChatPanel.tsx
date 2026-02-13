import { useState, useRef, useEffect } from 'react'
import { MessageSquare, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ChatMessage } from './ChatMessage'
import { useChatStore } from '@/stores/chatStore'
import { useRoomStore } from '@/stores/roomStore'
import { useChat } from '@/hooks/useChat'

export function ChatPanel() {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messages = useChatStore((s) => s.messages)
  const currentUser = useRoomStore((s) => s.currentUser)
  const { sendMessage } = useChat()

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleSend = () => {
    if (!input.trim()) return
    sendMessage(input)
    setInput('')
  }

  return (
    <div className="flex h-full w-full flex-col border-l border-border/50 bg-background/60 backdrop-blur-sm">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border/50 px-4 py-3">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">聊天</span>
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3" aria-live="polite" aria-label="聊天消息">
        <div className="py-3">
          {messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground/30 py-8">
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
      <div className="flex shrink-0 gap-2 border-t border-border/50 px-3 py-3">
        <Input
          placeholder="输入消息..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="flex-1"
          aria-label="输入聊天消息"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="secondary"
              onClick={handleSend}
              disabled={!input.trim()}
              aria-label="发送消息"
            >
              <Send className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>发送</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
