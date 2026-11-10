import { getSDK } from '@discourse-mini-app/sdk'
import {
  createSdkRoomSocket,
  type SdkRoomSocket,
  type SdkRoomSocketOptions,
} from '../../../client/src/lib/platform/SdkRoomSocket.ts'

export type MappRoomSocketOptions = Omit<SdkRoomSocketOptions, 'webSocket'>

/** Creates an opt-in room connection; no bootstrap Cookie or automatic connection. */
export function createMappRoomSocket(options: MappRoomSocketOptions): SdkRoomSocket {
  const sdk = getSDK()
  if (!sdk.permissions.has('network.websocket') || !sdk.permissions.has('user.read')) {
    throw new Error('MAPP_ROOM_PERMISSION_REQUIRED')
  }
  return createSdkRoomSocket({
    ...options,
    webSocket: { connect: (endpoint, connectOptions) => sdk.webSocket.connect(endpoint, connectOptions) },
  })
}
