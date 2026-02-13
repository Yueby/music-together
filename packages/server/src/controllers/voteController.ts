import { EVENTS, ERROR_CODE, TIMING, defineAbilityFor, voteStartSchema, voteCastSchema } from '@music-together/shared'
import type { Actions, VoteAction } from '@music-together/shared'
import { createWithRoom } from '../middleware/withRoom.js'
import * as voteService from '../services/voteService.js'
import * as playerService from '../services/playerService.js'
import * as queueService from '../services/queueService.js'
import { logger } from '../utils/logger.js'
import type { TypedServer, TypedSocket } from '../middleware/types.js'

/**
 * Execute the voted action on the player.
 * No initiatorSocket — broadcast to everyone since this is a collective decision.
 */
async function executeAction(io: TypedServer, roomId: string, action: VoteAction): Promise<void> {
  switch (action) {
    case 'pause':
      playerService.pauseTrack(io, roomId)
      break
    case 'resume':
      playerService.resumeTrack(io, roomId)
      break
    case 'next': {
      const nextTrack = queueService.getNextTrack(roomId)
      if (nextTrack) {
        await playerService.playTrackInRoom(io, roomId, nextTrack)
      }
      break
    }
    case 'prev': {
      const prevTrack = queueService.getPreviousTrack(roomId)
      if (prevTrack) {
        await playerService.playTrackInRoom(io, roomId, prevTrack)
      }
      break
    }
  }
}

export function registerVoteController(io: TypedServer, socket: TypedSocket) {
  const withRoom = createWithRoom(io)

  socket.on(
    EVENTS.VOTE_START,
    withRoom(async (ctx, raw) => {
      const parsed = voteStartSchema.safeParse(raw)
      if (!parsed.success) {
        ctx.socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.INVALID_INPUT, message: '无效的投票请求' })
        return
      }

      const { action } = parsed.data

      // Check if user has direct permission (host/admin don't need to vote)
      // VoteAction includes 'resume' which is not in CASL Actions — cast is intentional
      const ability = defineAbilityFor(ctx.user.role)
      if (ability.can(action as Actions, 'Player')) {
        ctx.socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.NO_VOTE_NEEDED, message: '你有直接操作权限，无需投票' })
        return
      }

      // Check if user can vote
      if (!ability.can('vote', 'Player')) {
        ctx.socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.NO_PERMISSION, message: '你没有投票权限' })
        return
      }

      const vote = voteService.createVote(
        ctx.roomId,
        ctx.room.hostId,
        ctx.user,
        action,
        ctx.room.users.length,
      )

      if (!vote) {
        ctx.socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.VOTE_IN_PROGRESS, message: '已有投票正在进行中' })
        return
      }

      // Check if the vote is already decided (e.g. only 1-2 users in the room)
      const approveCount = Object.values(vote.votes).filter(Boolean).length
      if (approveCount >= vote.requiredVotes) {
        // Auto-pass: execute immediately
        clearTimeout(vote.timeoutHandle)
        await executeAction(io, ctx.roomId, action)
        io.to(ctx.roomId).emit(EVENTS.VOTE_RESULT, { passed: true, action })
        voteService.cancelVote(ctx.roomId)
        return
      }

      // Set timeout for auto-reject
      vote.timeoutHandle = setTimeout(() => {
        io.to(ctx.roomId).emit(EVENTS.VOTE_RESULT, { passed: false, action, reason: 'timeout' })
        voteService.cancelVote(ctx.roomId)
        logger.info(`Vote timed out: ${action} in room ${ctx.roomId}`, { roomId: ctx.roomId })
      }, TIMING.VOTE_TIMEOUT_MS)

      // Broadcast vote started
      io.to(ctx.roomId).emit(EVENTS.VOTE_STARTED, voteService.toVoteState(vote))
    }),
  )

  socket.on(
    EVENTS.VOTE_CAST,
    withRoom(async (ctx, raw) => {
      const parsed = voteCastSchema.safeParse(raw)
      if (!parsed.success) {
        ctx.socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.INVALID_INPUT, message: '无效的投票数据' })
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
        clearTimeout(result.vote.timeoutHandle)

        if (result.passed) {
          await executeAction(io, ctx.roomId, result.vote.action)
        }

        io.to(ctx.roomId).emit(EVENTS.VOTE_RESULT, {
          passed: result.passed,
          action: result.vote.action,
          reason: result.reason,
        })

        voteService.cancelVote(ctx.roomId)
      }
    }),
  )
}
