import { Button } from '@/components/ui/button'
import { useSocketContext } from '@/providers/SocketProvider'
import { TIMING } from '@music-together/shared'
import type { VoteAction, VoteState } from '@music-together/shared'
import { Check, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

const ACTION_LABELS: Record<VoteAction, string> = {
  pause: '暂停播放',
  resume: '继续播放',
  next: '下一首',
  prev: '上一首',
}

interface VoteBannerProps {
  vote: VoteState
  onCastVote: (approve: boolean) => void
}

export function VoteBanner({ vote, onCastVote }: VoteBannerProps) {
  const { socket } = useSocketContext()
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, vote.expiresAt - Date.now()))

  const hasVoted = socket.id ? socket.id in vote.votes : false
  const approveCount = Object.values(vote.votes).filter(Boolean).length
  const rejectCount = Object.values(vote.votes).filter((v) => !v).length
  const progressPercent = Math.max(0, (remainingMs / TIMING.VOTE_TIMEOUT_MS) * 100)

  useEffect(() => {
    const interval = setInterval(() => {
      const ms = Math.max(0, vote.expiresAt - Date.now())
      setRemainingMs(ms)
      if (ms <= 0) clearInterval(interval)
    }, 100)
    return () => clearInterval(interval)
  }, [vote.expiresAt])

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="mx-auto w-full max-w-sm rounded-xl bg-white/10 px-4 py-3 backdrop-blur-md"
      >
        {/* Title */}
        <div className="mb-2 text-center text-sm font-medium text-white/90">
          <span className="text-white/60">{vote.initiatorNickname}</span>{' '}
          发起投票：{ACTION_LABELS[vote.action]}
        </div>

        {/* Progress bar (time remaining) */}
        <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-white/40 transition-[width] duration-100 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Votes count + buttons */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-white/60">
            {approveCount}/{vote.requiredVotes} 赞成
            {rejectCount > 0 && <span className="ml-2">{rejectCount} 反对</span>}
          </div>

          {!hasVoted ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 bg-green-500/20 px-3 text-xs text-green-300 hover:bg-green-500/30 hover:text-green-200"
                onClick={() => onCastVote(true)}
              >
                <Check className="h-3.5 w-3.5" />
                赞成
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 bg-red-500/20 px-3 text-xs text-red-300 hover:bg-red-500/30 hover:text-red-200"
                onClick={() => onCastVote(false)}
              >
                <X className="h-3.5 w-3.5" />
                反对
              </Button>
            </div>
          ) : (
            <span className="text-xs text-white/40">已投票</span>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
