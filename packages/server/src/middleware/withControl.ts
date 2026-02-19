import { EVENTS, ERROR_CODE, defineAbilityFor } from '@music-together/shared'
import type { Actions, Subjects } from '@music-together/shared'
import type { HandlerContext, TypedServer } from './types.js'
import { createWithRoom } from './withRoom.js'

/**
 * Socket 中间件：基于 CASL 权限检查。
 * 根据用户 role 生成 ability，检查 (action, subject) 是否允许。
 */
export function createWithPermission(io: TypedServer) {
  const withRoom = createWithRoom(io)

  return function withPermission<T = void>(
    action: Actions,
    subject: Subjects,
    handler: (ctx: HandlerContext, data: T) => void | Promise<void>,
  ) {
    return withRoom<T>((ctx, data) => {
      const ability = defineAbilityFor(ctx.user.role)
      if (!ability.can(action, subject)) {
        ctx.socket.emit(EVENTS.ROOM_ERROR, {
          code: ERROR_CODE.NO_PERMISSION,
          message: '你没有权限执行此操作',
        })
        return
      }
      return handler(ctx, data)
    })
  }
}

/**
 * Socket 中间件：仅 Host 可执行。
 * 用于房间设置等只有房主才能操作的场景。
 */
export function createWithHostOnly(io: TypedServer) {
  const withRoom = createWithRoom(io)

  return function withHostOnly<T = void>(handler: (ctx: HandlerContext, data: T) => void | Promise<void>) {
    return withRoom<T>((ctx, data) => {
      if (ctx.room.hostId !== ctx.user.id) {
        ctx.socket.emit(EVENTS.ROOM_ERROR, {
          code: ERROR_CODE.NO_PERMISSION,
          message: '只有房主可以操作',
        })
        return
      }
      return handler(ctx, data)
    })
  }
}
