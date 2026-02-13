import { useCallback, useEffect, useState } from 'react'
import { EVENTS } from '@music-together/shared'
import type { VoteAction, VoteState } from '@music-together/shared'
import { useSocketContext } from '@/providers/SocketProvider'
import { useSocketEvent } from './useSocketEvent'
import { toast } from 'sonner'

const ACTION_LABELS: Record<VoteAction, string> = {
  pause: '暂停',
  resume: '播放',
  next: '下一首',
  prev: '上一首',
}

export function useVote() {
  const { socket } = useSocketContext()
  const [activeVote, setActiveVote] = useState<VoteState | null>(null)

  useSocketEvent(EVENTS.VOTE_STARTED, useCallback((vote: VoteState) => {
    setActiveVote(vote)
  }, []))

  useSocketEvent(EVENTS.VOTE_RESULT, useCallback((data: { passed: boolean; action: VoteAction; reason?: string }) => {
    setActiveVote(null)
    const label = ACTION_LABELS[data.action]
    if (data.passed) {
      toast.success(`投票通过：${label}`)
    } else {
      const reasonText = data.reason === 'host_veto' ? '（房主否决）'
        : data.reason === 'timeout' ? '（超时）'
        : ''
      toast.error(`投票未通过：${label}${reasonText}`)
    }
  }, []))

  // Clear active vote on disconnect
  useEffect(() => {
    const onDisconnect = () => setActiveVote(null)
    socket.on('disconnect', onDisconnect)
    return () => { socket.off('disconnect', onDisconnect) }
  }, [socket])

  const startVote = useCallback(
    (action: VoteAction) => {
      socket.emit(EVENTS.VOTE_START, { action })
    },
    [socket],
  )

  const castVote = useCallback(
    (approve: boolean) => {
      socket.emit(EVENTS.VOTE_CAST, { approve })
    },
    [socket],
  )

  return { activeVote, startVote, castVote }
}
