import type { RoomCommands } from '../../../../client/src/lib/RoomCommands.ts'
import { getMappHost } from '../hostBinding.ts'

export const roomCommands: RoomCommands = {
  create: (socket, input) => getMappHost().roomCommands.create(socket, input),
  join: (socket, input, options) => getMappHost().roomCommands.join(socket, input, options),
  leave: (socket) => getMappHost().roomCommands.leave(socket),
}
