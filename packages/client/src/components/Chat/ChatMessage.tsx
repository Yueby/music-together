import dayjs from 'dayjs'
import type { ChatMessage as ChatMessageType } from '@music-together/shared'
import { cn } from '@/lib/utils'

interface ChatMessageProps {
  message: ChatMessageType
  isOwnMessage: boolean
}

export function ChatMessage({ message, isOwnMessage }: ChatMessageProps) {
  if (message.type === 'system') {
    return (
      <div className="py-1 text-center text-xs text-muted-foreground">
        {message.content}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-0.5 py-1', isOwnMessage && 'items-end')}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {message.nickname}
        </span>
        <span className="text-xs text-muted-foreground/50">
          {dayjs(message.timestamp).format('HH:mm')}
        </span>
      </div>
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-3 py-1.5 text-sm break-words',
          isOwnMessage
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted',
        )}
      >
        {message.content}
      </div>
    </div>
  )
}
