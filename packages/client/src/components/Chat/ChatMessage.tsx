import { memo } from 'react'
import dayjs from 'dayjs'
import { motion } from 'motion/react'
import type { ChatMessage as ChatMessageType } from '@music-together/shared'
import { cn } from '@/lib/utils'

interface ChatMessageProps {
  message: ChatMessageType
  isOwnMessage: boolean
}

export const ChatMessage = memo(function ChatMessage({ message, isOwnMessage }: ChatMessageProps) {
  if (message.type === 'system') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="py-1.5 text-center text-xs text-muted-foreground/50"
      >
        {message.content}
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={cn('flex flex-col gap-0.5 py-1.5', isOwnMessage ? 'items-end' : 'items-start')}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {message.nickname}
        </span>
        <span className="text-xs text-muted-foreground/40">
          {dayjs(message.timestamp).format('HH:mm')}
        </span>
      </div>
      <div
        className={cn(
          'max-w-[80%] rounded-xl px-3 py-2 text-sm break-words',
          isOwnMessage
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-secondary-foreground',
        )}
      >
        {message.content}
      </div>
    </motion.div>
  )
})
