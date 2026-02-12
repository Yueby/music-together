import { EVENTS } from '@music-together/shared'
import type { HandlerContext, TypedServer, TypedSocket } from './types.js'
import { createWithRoom } from './withRoom.js'

/**
 * Socket 中间件：在 withRoom 基础上校验用户是否有播放控制权限。
 * collaborative 模式下所有人都有权限；host-only 模式下只有 host 有权限。
 */
export function createWithControl(io: TypedServer) {
  const withRoom = createWithRoom(io)

  return function withControl<T = void>(
    handler: (ctx: HandlerContext, data: T) => void | Promise<void>,
  ) {
    return withRoom<T>((ctx, data) => {
      if (ctx.room.mode === 'host-only' && ctx.room.hostId !== ctx.user.id) {
        ctx.socket.emit(EVENTS.ROOM_ERROR, {
          code: 'NO_PERMISSION',
          message: '当前模式下只有房主可以操作',
        })
        return
      }
      return handler(ctx, data)
    })
  }
}
