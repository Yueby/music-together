import { EVENTS, ERROR_CODE, TIMING, defineAbilityFor, voteStartSchema, voteCastSchema } from '@music-together/shared'
import type { Actions, Subjects, VoteAction } from '@music-together/shared'
import { createWithRoom } from '../middleware/withRoom.js'
import { withSocketRateLimit } from '../middleware/withControl.js'
import * as voteService from '../services/voteService.js'
import { executeVoteAction } from '../services/voteActionService.js'
import { logger } from '../utils/logger.js'
import type { TypedServer, TypedSocket } from '../middleware/types.js'

export function registerVoteController(io: TypedServer, socket: TypedSocket) {
  const withRoom = createWithRoom(io)

  socket.on(
    EVENTS.VOTE_START,
    withRoom(withSocketRateLimit(async (ctx, raw) => {
      const parsed = voteStartSchema.safeParse(raw)
      if (!parsed.success) {
        ctx.socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.INVALID_INPUT, message: '无效的投票请求' })
        return
      }

      const { action, payload } = parsed.data
      const votePayload = payload as Record<string, unknown> | undefined

      // Check if user has direct permission (owner/admin don't need to vote).
      // VoteAction includes 'resume' which is not in CASL Actions — cast is intentional.
      // Some vote actions map to a different CASL action for permission checks
      // (e.g. 'play-track' requires the same 'play' permission as normal playback).
      // Safety net: if the client mistakenly routes through VOTE_START (e.g. due to
      // client-server role desync), execute the action directly instead of returning an error.
      const PERM_MAP: Partial<Record<VoteAction, { action: Actions; subject: Subjects }>> = {
        resume: { action: 'play', subject: 'Player' },
        'play-track': { action: 'play', subject: 'Player' },
        'remove-track': { action: 'remove', subject: 'Queue' },
      }
      const ability = defineAbilityFor(ctx.user.role)
      const permission = PERM_MAP[action]
      const permissionAction = permission?.action ?? (action as Actions)
      const permissionSubject = permission?.subject ?? 'Player'
      if (ability.can(permissionAction, permissionSubject)) {
        await executeVoteAction(io, ctx.roomId, action, votePayload)
        logger.info(`Direct-executed ${action} for privileged user ${ctx.user.nickname} (role: ${ctx.user.role})`, {
          roomId: ctx.roomId,
        })
        return
      }

      // Check if user can vote
      if (!ability.can('vote', 'Player')) {
        ctx.socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.NO_PERMISSION, message: '你没有投票权限' })
        return
      }

      const vote = voteService.createVote(ctx.roomId, ctx.room.hostId, ctx.user, action, ctx.room.users.length, votePayload)

      if (!vote) {
        ctx.socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.VOTE_IN_PROGRESS, message: '已有投票正在进行中' })
        return
      }

      // Check if the vote is already decided (e.g. only 1-2 users in the room)
      const approveCount = Object.values(vote.votes).filter(Boolean).length
      if (approveCount >= vote.requiredVotes) {
        // Claim before executing asynchronous effects so this vote can run only once.
        const claimedVote = voteService.claimVote(ctx.roomId, vote.id)
        if (!claimedVote) return
        const executed = await executeVoteAction(io, ctx.roomId, action, claimedVote.payload)
        io.to(ctx.roomId).emit(EVENTS.VOTE_RESULT, {
          passed: executed,
          action,
          reason: executed ? undefined : 'action_failed',
        })
        return
      }

      // Set timeout for auto-reject
      vote.timeoutHandle = setTimeout(() => {
        const claimedVote = voteService.claimVote(ctx.roomId, vote.id)
        if (!claimedVote) return
        io.to(ctx.roomId).emit(EVENTS.VOTE_RESULT, { passed: false, action, reason: 'timeout' })
        logger.info(`Vote timed out: ${action} in room ${ctx.roomId}`, { roomId: ctx.roomId })
      }, TIMING.VOTE_TIMEOUT_MS)

      // Broadcast vote started
      io.to(ctx.roomId).emit(EVENTS.VOTE_STARTED, voteService.toVoteState(vote))
    })),
  )

  socket.on(
    EVENTS.VOTE_CAST,
    withRoom(withSocketRateLimit(async (ctx, raw) => {
      const parsed = voteCastSchema.safeParse(raw)
      if (!parsed.success) {
        ctx.socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.INVALID_INPUT, message: '无效的投票数据' })
        return
      }

      if (!voteService.getActiveVote(ctx.roomId)) {
        ctx.socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.INVALID_INPUT, message: '当前没有进行中的投票' })
        return
      }

      const result = voteService.castVote(ctx.roomId, ctx.user.id, parsed.data.approve)
      if (!result) {
        ctx.socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.ALREADY_VOTED, message: '你已经投过票了' })
        return
      }

      // Broadcast updated vote state
      io.to(ctx.roomId).emit(EVENTS.VOTE_STARTED, voteService.toVoteState(result.vote))

      if (result.decided) {
        const claimedVote = voteService.claimVote(ctx.roomId, result.vote.id)
        if (!claimedVote) return

        const executed = result.passed
          ? await executeVoteAction(io, ctx.roomId, claimedVote.action, claimedVote.payload)
          : false

        io.to(ctx.roomId).emit(EVENTS.VOTE_RESULT, {
          passed: result.passed && executed,
          action: claimedVote.action,
          reason: result.passed && !executed ? 'action_failed' : result.reason,
        })
      }
    })),
  )
}
