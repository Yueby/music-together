import { EVENTS, ERROR_CODE } from '@music-together/shared'
import { roomRepo } from '../repositories/roomRepository.js'
import { logger } from '../utils/logger.js'
import type { HandlerContext, TypedServer, TypedSocket } from './types.js'

/**
 * Socket 中间件：校验用户是否在房间内，自动注入 HandlerContext。
 * 失败时 emit ROOM_ERROR 并中止。
 */
export function createWithRoom(io: TypedServer) {
  return function withRoom<T = void>(handler: (ctx: HandlerContext, data: T) => void | Promise<void>) {
    return function (this: TypedSocket, data: T) {
      const socket = this
      const mapping = roomRepo.getSocketMapping(socket.id)
      if (!mapping) {
        socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.NOT_IN_ROOM, message: '你不在任何房间中' })
        return
      }

      const room = roomRepo.get(mapping.roomId)
      if (!room) {
        logger.warn(`withRoom: room ${mapping.roomId} not found for socket ${socket.id}`)
        socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.ROOM_NOT_FOUND, message: '房间不存在' })
        return
      }

      const user = room.users.find((u) => u.id === mapping.userId)
      if (!user) {
        logger.warn(`withRoom: user ${mapping.userId} not found in room ${mapping.roomId}`)
        socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.NOT_IN_ROOM, message: '你不在该房间中' })
        return
      }

      const ctx: HandlerContext = {
        io,
        socket,
        roomId: mapping.roomId,
        room,
        user,
      }

      Promise.resolve(handler(ctx, data)).catch((err) => {
        logger.error('Handler error', err, { roomId: mapping.roomId })
        socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.INTERNAL, message: '服务器内部错误' })
      })
    }
  }
}
