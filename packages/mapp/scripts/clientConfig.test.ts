import { describe, expect, it } from 'vitest'
import { MAPP_CLIENT_HTML, resolveMappClientTarget } from './clientConfig.ts'

const roomUrl = 'wss://rooms.example.com/socket.io/?EIO=4&transport=websocket'

describe('client configuration boundary', () => {
  it('derives a canonical socket target and HTTPS origin from the reviewed transport', () => {
    expect(resolveMappClientTarget(roomUrl)).toEqual({
      endpoint: 'roomSocket',
      roomUrl,
      serverOrigin: 'https://rooms.example.com',
    })
    expect(resolveMappClientTarget('wss://ROOMS.example.com:443/socket.io/?transport=websocket&EIO=4')).toEqual(
      resolveMappClientTarget(roomUrl),
    )
    expect(MAPP_CLIENT_HTML).toContain('id="mapp-root"')
    expect(MAPP_CLIENT_HTML).not.toMatch(/<(?:link|iframe|script|style)\b/i)
  })

  it.each([
    undefined,
    '',
    'https://rooms.example.com/socket.io/?EIO=4&transport=websocket',
    'ws://rooms.example.com/socket.io/?EIO=4&transport=websocket',
    'wss://user:password@rooms.example.com/socket.io/?EIO=4&transport=websocket',
    'wss://user@rooms.example.com/socket.io/?EIO=4&transport=websocket',
    'wss://rooms.example.com:8443/socket.io/?EIO=4&transport=websocket',
    'wss://rooms.example.com/other/?EIO=4&transport=websocket',
    'wss://rooms.example.com/socket.io?EIO=4&transport=websocket',
    'wss://rooms.example.com/a/../socket.io/?EIO=4&transport=websocket',
    'wss://rooms.example.com/%73ocket.io/?EIO=4&transport=websocket',
    'wss://rooms.example.com/socket.io/',
    'wss://rooms.example.com/socket.io/?EIO=3&transport=websocket',
    'wss://rooms.example.com/socket.io/?EIO=4&transport=polling',
    `${roomUrl}&EIO=4`,
    `${roomUrl}&transport=websocket`,
    `${roomUrl}&token=fixture-token`,
    `${roomUrl}&mini_app_token=fixture-token`,
    `${roomUrl}&sid=fixture-session`,
    `${roomUrl}&signature=fixture-signature`,
    `${roomUrl}&redirect=https://elsewhere.example.com`,
    `${roomUrl}#fragment`,
    `${roomUrl}#`,
    `${roomUrl}\n`,
    ` ${roomUrl}`,
    'wss://rooms.example.com\\socket.io/?EIO=4&transport=websocket',
    `wss://${'a'.repeat(2050)}/socket.io/?EIO=4&transport=websocket`,
  ])('rejects unreviewed room configuration %#', (value) => {
    expect(() => resolveMappClientTarget(value)).toThrow('MAPP_CLIENT_TARGET_REJECTED')
  })
})
