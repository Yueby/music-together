import { nanoid } from 'nanoid'
import type { VoteAction, VoteState, User } from '@music-together/shared'
import { TIMING } from '@music-together/shared'
import { logger } from '../utils/logger.js'

interface Vote {
  id: string
  roomId: string
  action: VoteAction
  initiatorId: string
  initiatorNickname: string
  votes: Record<string, boolean>
  requiredVotes: number
  totalUsers: number
  expiresAt: number
  timeoutHandle: ReturnType<typeof setTimeout>
  hostId: string
  payload?: Record<string, unknown>
}

interface CastResult {
  vote: Vote
  decided: boolean
  passed: boolean
  reason?: string
}

/** Active vote per room (at most one at a time) */
const activeVotes = new Map<string, Vote>()

/**
 * Create a new vote. Returns null if a vote is already in progress.
 * The initiator automatically votes "approve".
 */
export function createVote(
  roomId: string,
  hostId: string,
  initiator: User,
  action: VoteAction,
  totalUsers: number,
  payload?: Record<string, unknown>,
): Vote | null {
  if (activeVotes.has(roomId)) return null

  const requiredVotes = Math.floor(totalUsers / 2) + 1

  const vote: Vote = {
    id: nanoid(8),
    roomId,
    action,
    initiatorId: initiator.id,
    initiatorNickname: initiator.nickname,
    votes: { [initiator.id]: true }, // auto-approve by initiator
    requiredVotes,
    totalUsers,
    expiresAt: Date.now() + TIMING.VOTE_TIMEOUT_MS,
    timeoutHandle: null as unknown as ReturnType<typeof setTimeout>, // set by controller
    hostId,
    payload,
  }

  activeVotes.set(roomId, vote)
  logger.info(`Vote created: ${action} in room ${roomId} by ${initiator.nickname}`, { roomId })
  return vote
}

/**
 * Cast a vote. Returns the result or null if no active vote.
 * Host veto: if host votes reject, immediately decided as failed.
 */
export function castVote(roomId: string, userId: string, approve: boolean): CastResult | null {
  const vote = activeVotes.get(roomId)
  if (!vote) return null

  // Already voted
  if (userId in vote.votes) return null

  vote.votes[userId] = approve

  // Host veto check
  if (userId === vote.hostId && !approve) {
    return { vote, decided: true, passed: false, reason: 'host_veto' }
  }

  const approveCount = Object.values(vote.votes).filter(Boolean).length
  const rejectCount = Object.values(vote.votes).filter((v) => !v).length

  // Passed: enough approvals
  if (approveCount >= vote.requiredVotes) {
    return { vote, decided: true, passed: true }
  }

  // Mathematically impossible to pass
  if (rejectCount > vote.totalUsers - vote.requiredVotes) {
    return { vote, decided: true, passed: false, reason: 'rejected' }
  }

  // Not decided yet
  return { vote, decided: false, passed: false }
}

export function getActiveVote(roomId: string): Vote | null {
  return activeVotes.get(roomId) ?? null
}

export function cancelVote(roomId: string): void {
  const vote = activeVotes.get(roomId)
  if (vote) {
    clearTimeout(vote.timeoutHandle)
    activeVotes.delete(roomId)
  }
}

export function cleanupRoom(roomId: string): void {
  cancelVote(roomId)
}

/** Convert internal Vote to client-safe VoteState */
export function toVoteState(vote: Vote): VoteState {
  return {
    id: vote.id,
    action: vote.action,
    initiatorId: vote.initiatorId,
    initiatorNickname: vote.initiatorNickname,
    votes: { ...vote.votes },
    requiredVotes: vote.requiredVotes,
    totalUsers: vote.totalUsers,
    expiresAt: vote.expiresAt,
    payload: vote.payload,
  }
}
