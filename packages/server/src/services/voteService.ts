import { nanoid } from 'nanoid'
import type { VoteAction, VoteState, User } from '@music-together/shared'
import { TIMING } from '@music-together/shared'
import { logger } from '../utils/logger.js'
import { roomRepo } from '../repositories/roomRepository.js'
import { getLatestPlayback } from './playerService.js'
import { registerRoomCleanup } from './roomCleanupRegistry.js'

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

export interface VoteDecision {
  vote: Vote
  decided: boolean
  passed: boolean
  reason?: 'host_veto' | 'rejected'
}

/** Active vote per room (at most one at a time) */
const activeVotes = new Map<string, Vote>()
registerRoomCleanup('vote', cleanupRoom)

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
  if (action === 'next' || action === 'prev') {
    const room = roomRepo.get(roomId)
    const trackId = room ? getLatestPlayback(room).track?.id : undefined
    payload = trackId ? { trackId } : undefined
  }

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
 * Conductor veto: if conductor (hostId) votes reject, immediately decided as failed.
 */
function evaluateVote(vote: Vote): VoteDecision {
  if (vote.votes[vote.hostId] === false) {
    return { vote, decided: true, passed: false, reason: 'host_veto' }
  }

  const approveCount = Object.values(vote.votes).filter(Boolean).length
  const rejectCount = Object.values(vote.votes).filter((value) => !value).length

  if (approveCount >= vote.requiredVotes) {
    return { vote, decided: true, passed: true }
  }

  if (rejectCount > vote.totalUsers - vote.requiredVotes) {
    return { vote, decided: true, passed: false, reason: 'rejected' }
  }

  return { vote, decided: false, passed: false }
}

export function castVote(roomId: string, userId: string, approve: boolean): VoteDecision | null {
  const vote = activeVotes.get(roomId)
  if (!vote) return null

  // Already voted
  if (userId in vote.votes) return null

  vote.votes[userId] = approve

  // The current room host can veto an active vote.
  if (userId === vote.hostId && !approve) {
    return { vote, decided: true, passed: false, reason: 'host_veto' }
  }

  return evaluateVote(vote)
}

/**
 * Reconcile an active vote against the room's current online membership and host.
 * Votes from departed users are removed; newly joined users increase the majority
 * threshold and may vote normally after receiving the active vote state.
 */
export function reconcileVote(
  roomId: string,
  currentUserIds: readonly string[],
  currentHostId: string,
): VoteDecision | null {
  const vote = activeVotes.get(roomId)
  if (!vote) return null

  const onlineUsers = new Set(currentUserIds)
  for (const userId of Object.keys(vote.votes)) {
    if (!onlineUsers.has(userId)) delete vote.votes[userId]
  }

  vote.totalUsers = currentUserIds.length
  vote.requiredVotes = Math.floor(vote.totalUsers / 2) + 1
  vote.hostId = currentHostId
  logger.info(`Vote reconciled: ${vote.requiredVotes} required (${vote.totalUsers} users)`, { roomId })
  return evaluateVote(vote)
}

export function getActiveVote(roomId: string): Vote | null {
  return activeVotes.get(roomId) ?? null
}

/**
 * Atomically remove a decided vote before its asynchronous side effect runs.
 * Only the caller that successfully claims the exact vote ID may execute it.
 */
export function claimVote(roomId: string, voteId: string): Vote | null {
  const vote = activeVotes.get(roomId)
  if (!vote || vote.id !== voteId) return null
  activeVotes.delete(roomId)
  clearTimeout(vote.timeoutHandle)
  return vote
}

export function cancelVote(roomId: string, voteId?: string): void {
  const vote = activeVotes.get(roomId)
  if (!vote || (voteId !== undefined && vote.id !== voteId)) return
  clearTimeout(vote.timeoutHandle)
  activeVotes.delete(roomId)
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
