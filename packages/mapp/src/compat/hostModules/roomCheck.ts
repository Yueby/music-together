import type { RoomCheckReader } from '../../../../client/src/lib/RoomCheckReader.ts'
import { getMappHost } from '../hostBinding.ts'

export const roomCheck: RoomCheckReader = (socket, roomId, options) => getMappHost().roomCheck(socket, roomId, options)
