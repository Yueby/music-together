import { describe, expect, it, vi } from 'vitest'
import { EVENTS } from '@music-together/shared'
import type { TypedSocket } from './socket'
import { roomCommands } from './RoomCommands'

function fixture() {
  const emit = vi.fn()
  const socket = { emit } as unknown as TypedSocket
  return { socket, emit }
}

describe('Web room commands', () => {
  it('emits create with the original payload and returns true', () => {
    const { socket, emit } = fixture()
    const input = { nickname: 'Listener', roomName: 'Together', password: 'fixture-password' }

    expect(roomCommands.create(socket, input)).toBe(true)
    expect(emit).toHaveBeenCalledExactlyOnceWith(EVENTS.ROOM_CREATE, input)
    expect(emit.mock.calls[0][1]).toBe(input)
  })

  it.each([undefined, {}, { automatic: false }, { automatic: true }])(
    'passes the original join payload including the Web rejoin token for options %j',
    (options) => {
      const { socket, emit } = fixture()
      const input = {
        roomId: 'original-room',
        nickname: 'Listener',
        password: 'fixture-password',
        rejoinToken: 'fixture-web-ticket',
      }

      expect(roomCommands.join(socket, input, options)).toBe(true)
      expect(emit).toHaveBeenCalledExactlyOnceWith(EVENTS.ROOM_JOIN, input)
      expect(emit.mock.calls[0][1]).toBe(input)
    },
  )

  it('emits leave exactly once without a payload', () => {
    const { socket, emit } = fixture()

    expect(roomCommands.leave(socket)).toBeUndefined()
    expect(emit).toHaveBeenCalledExactlyOnceWith(EVENTS.ROOM_LEAVE)
  })

  it('does not retry or mask socket errors', () => {
    const { socket, emit } = fixture()
    const error = new Error('fixture emit failure')
    emit.mockImplementation(() => { throw error })

    expect(() => roomCommands.join(socket, { roomId: 'original-room', nickname: 'Listener' })).toThrow(error)
    expect(emit).toHaveBeenCalledTimes(1)
  })
})
