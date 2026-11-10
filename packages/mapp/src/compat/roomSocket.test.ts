import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MiniAppSDK } from '@discourse-mini-app/sdk'
import { getSDK } from '@discourse-mini-app/sdk'
import { createSdkRoomSocket } from '../../../client/src/lib/platform/SdkRoomSocket.ts'
import { createMappRoomSocket } from './roomSocket.ts'

vi.mock('@discourse-mini-app/sdk', () => ({ getSDK: vi.fn() }))
vi.mock('../../../client/src/lib/platform/SdkRoomSocket.ts', () => ({ createSdkRoomSocket: vi.fn() }))

const options = {
  endpoint: 'room_socket',
  reviewedEndpointUrl: 'wss://music.example.test/socket.io/?EIO=4&transport=websocket',
}
function sdk(permissions: string[] = ['network.websocket', 'user.read']) {
  const connect = vi.fn().mockResolvedValue({ ready: Promise.resolve() })
  return {
    value: {
      permissions: { has: (name: string) => permissions.includes(name) },
      webSocket: { connect },
    } as unknown as MiniAppSDK,
    connect,
  }
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('Mapp room connection binding', () => {
  it('binds only the granted SDK and forwards connection options without connecting automatically', async () => {
    const f = sdk()
    vi.mocked(getSDK).mockReturnValue(f.value)
    const socket = { connected: false } as ReturnType<typeof createSdkRoomSocket>
    vi.mocked(createSdkRoomSocket).mockReturnValueOnce(socket)
    const result = createMappRoomSocket(options)
    expect(result).toBe(socket)
    expect(f.connect).not.toHaveBeenCalled()
    const passed = vi.mocked(createSdkRoomSocket).mock.calls[0]![0]
    expect(passed).toMatchObject(options)
    const connectOptions = { textMode: 'text' as const, signal: new AbortController().signal, timeoutMs: 1000 }
    await passed.webSocket.connect('room_socket', connectOptions)
    expect(f.connect).toHaveBeenCalledExactlyOnceWith('room_socket', connectOptions)
  })

  it.each([{ permissions: [] }, { permissions: ['network.websocket'] }, { permissions: ['user.read'] }])(
    'requires both identity and WebSocket grants: %j',
    ({ permissions }) => {
      vi.mocked(getSDK).mockReturnValue(sdk(permissions).value)
      expect(() => createMappRoomSocket(options)).toThrow('MAPP_ROOM_PERMISSION_REQUIRED')
      expect(createSdkRoomSocket).not.toHaveBeenCalled()
    },
  )
})
