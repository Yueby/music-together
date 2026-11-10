import type { RoomCommands } from '../../../client/src/lib/RoomCommands.ts'
import type { TypedSocket } from '../../../client/src/lib/socket.ts'
import type { MappRoomSession } from './RoomSession.ts'

export function createMappRoomCommands(
  session: Pick<MappRoomSession, 'socket' | 'snapshot' | 'createRoom' | 'joinRoom' | 'leaveRoom'>,
): RoomCommands {
  function assertSocket(socket: TypedSocket): void {
    if (socket !== session.socket) throw new Error('MAPP_ROOM_SOCKET_MISMATCH')
  }

  return {
    create(socket, input) {
      assertSocket(socket)
      return session.createRoom({
        nickname: input.nickname,
        roomName: input.roomName,
        password: input.password,
      })
    },
    join(socket, input, options) {
      assertSocket(socket)
      if (options?.automatic) {
        const { status, roomId } = session.snapshot
        if (status === 'joining' || status === 'creating' || (status === 'joined' && roomId === input.roomId)) {
          return true
        }
      }
      return session.joinRoom({
        roomId: input.roomId,
        nickname: input.nickname,
        password: input.password,
      })
    },
    leave(socket) {
      assertSocket(socket)
      session.leaveRoom()
    },
  }
}
