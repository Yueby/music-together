import { Button } from '@/components/ui/button'
import { getVoteActionLabel } from '@/hooks/useVote'
import { storage } from '@/lib/storage'
import { TIMING } from '@music-together/shared'
import type { VoteState } from '@music-together/shared'
import { Check, X } from 'lucide-react'
import { m, useReducedMotion } from 'motion/react'
import { useState } from 'react'

interface VoteBannerProps {
  vote: VoteState
  onCastVote: (approve: boolean) => void
}

function VoteCountdownBar({ expiresAt, reducedMotion }: { expiresAt: number; reducedMotion: boolean }) {
  const [remainingMs] = useState(() => Math.max(0, expiresAt - Date.now()))
  const initialScale = Math.max(0, Math.min(1, remainingMs / TIMING.VOTE_TIMEOUT_MS))
  const remainingSeconds = remainingMs / 1000

  return (
    <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-white/15">
      {reducedMotion ? (
        <div
          data-testid="vote-countdown-bar"
          data-reduced-motion="true"
          className="h-full w-full origin-left rounded-full bg-white/75"
          style={{ transform: `scaleX(${initialScale})` }}
        />
      ) : (
        <m.div
          data-testid="vote-countdown-bar"
          className="h-full w-full origin-left rounded-full bg-white/75 will-change-transform"
          initial={{ scaleX: initialScale }}
          animate={{ scaleX: 0 }}
          transition={{ duration: remainingSeconds, ease: 'linear' }}
        />
      )}
    </div>
  )
}

export function VoteBanner({ vote, onCastVote }: VoteBannerProps) {
  const prefersReducedMotion = useReducedMotion()
  const myUserId = storage.getUserId()
  const hasVoted = myUserId in vote.votes
  const approveCount = Object.values(vote.votes).filter(Boolean).length
  const rejectCount = Object.values(vote.votes).filter((v) => !v).length

  return (
    <m.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={prefersReducedMotion ? { duration: 0.1 } : { duration: 0.2, ease: 'easeOut' }}
      className="w-full rounded-xl border border-white/15 bg-black/50 px-4 py-3 shadow-lg shadow-black/25 backdrop-blur-md"
    >
      {/* Title */}
      <div className="mb-2 text-center text-sm font-medium text-white/95">
        <span className="text-white/75">{vote.initiatorNickname}</span> 发起投票：
        {getVoteActionLabel(vote.action, vote.payload)}
      </div>

      {/* Progress bar (GPU-accelerated scaleX countdown) */}
      <VoteCountdownBar key={vote.expiresAt} expiresAt={vote.expiresAt} reducedMotion={Boolean(prefersReducedMotion)} />

      {/* Votes count + buttons */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-white/75">
          {approveCount}/{vote.requiredVotes} 赞成
          {rejectCount > 0 && <span className="ml-2">{rejectCount} 反对</span>}
        </div>

        {!hasVoted ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 min-h-11 gap-1 bg-green-500/25 px-3 text-xs text-green-200 hover:bg-green-500/35 hover:text-green-100 sm:min-h-0"
              onClick={() => onCastVote(true)}
            >
              <Check className="h-3.5 w-3.5" />
              赞成
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 min-h-11 gap-1 bg-red-500/25 px-3 text-xs text-red-200 hover:bg-red-500/35 hover:text-red-100 sm:min-h-0"
              onClick={() => onCastVote(false)}
            >
              <X className="h-3.5 w-3.5" />
              反对
            </Button>
          </div>
        ) : (
          <span className="text-xs text-white/65">已投票</span>
        )}
      </div>
    </m.div>
  )
}
