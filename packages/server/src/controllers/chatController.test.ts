import { ERROR_CODE, EVENTS, LIMITS } from '@music-together/shared'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createMessage: vi.fn((_roomId: string, user: { id: string }, content: string) => ({ userId: user.id, content })),
}))

vi.mock('../services/chatService.js', () => ({ createMessage: mocks.createMessage }))
vi.mock('../repositories/roomRepository.js', () => {
  const room = { id: 'ROOM01', users: [{ id: 'identity-a', nickname: 'A' }] }
  return {
    roomRepo: {
      getSocketMapping: (socketId: string) => ({ roomId: 'ROOM01', userId: 'identity-a', socketId }),
      get: () => room,
    },
  }
})
vi.mock('../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { registerChatController } from './chatController.js'

/** One browser tab: its own socket id, the same identity as every other tab of the person. */
function tab(socketId: string) {
  let handler!: (this: unknown, raw: unknown) => void
  const emitted: Array<[string, unknown]> = []
  const socket = {
    id: socketId,
    on: (_event: string, fn: typeof handler) => {
      handler = fn
    },
    emit: (event: string, payload: unknown) => emitted.push([event, payload]),
  }
  const io = { to: () => ({ emit: vi.fn() }) }
  registerChatController(io as never, socket as never)
  return {
    // The handler is async behind withRoom: let its promise chain settle.
    say: async (content: string) => {
      handler.call(socket, { content })
      await new Promise((resolve) => setImmediate(resolve))
    },
    errors: () => emitted.filter(([name]) => name === EVENTS.ROOM_ERROR).map(([, payload]) => payload),
  }
}

describe('chat rate limit', () => {
  it('shares one budget between all tabs of an identity, instead of one per socket', async () => {
    const budget = LIMITS.CHAT_RATE_LIMIT_PER_SECOND
    const tabs = [tab('socket-1'), tab('socket-2'), tab('socket-3')]

    // Spread over three tabs, the same person gets the budget once, not three times.
    for (let i = 0; i < budget * 3; i++) await tabs[i % 3].say(`hello ${i}`)

    expect(mocks.createMessage).toHaveBeenCalledTimes(budget)
    const refused = tabs.flatMap((t) => t.errors())
    expect(refused).toHaveLength(budget * 2)
    expect(refused[0]).toMatchObject({ code: ERROR_CODE.RATE_LIMITED })
  })
})
