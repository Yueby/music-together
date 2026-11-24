import { describe, expect, it } from 'vitest'
import { extractLaunchRoomId } from './launchRoom.ts'

describe('extractLaunchRoomId', () => {
  it('prefers the first room query value over roomId and hash', () => {
    expect(extractLaunchRoomId({
      query: { room: ['  First_room-1  ', 'second'], roomId: ['alternate'] },
      hash: '/room/hash-room',
    })).toBe('First_room-1')
  })

  it('checks roomId when the first room value is invalid', () => {
    expect(extractLaunchRoomId({
      query: { room: ['invalid/id', 'ignored'], roomId: '  alternate  ' },
    })).toBe('alternate')
  })

  it.each([
    '#/room/hash-room',
    'room/hash-room',
    'room=%20hash-room%20&roomId=alternate',
    '#roomId=hash-room',
  ])('reads supported hash form %s when both query keys are invalid', (hash) => {
    expect(extractLaunchRoomId({ query: { room: {}, roomId: [''] }, hash })).toBe('hash-room')
  })

  it.each([
    undefined,
    null,
    'room=string',
    { query: { room: [42, 'valid'] } },
    { query: { room: ['valid', false] } },
    { query: { room: 'a'.repeat(21) } },
    { hash: 42 },
    { hash: '#/room/extra/segment' },
    { hash: 'room=https%3A%2F%2Fmusic.example' },
    { hash: '#other=unrecognized' },
  ])('rejects missing or malformed input %j', (params) => {
    expect(extractLaunchRoomId(params)).toBeUndefined()
  })
})
