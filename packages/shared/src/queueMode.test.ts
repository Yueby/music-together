import { describe, expect, it } from 'vitest'
import { roomSettingsSchema } from './schemas.js'
import { effectivePlayMode, type PlayMode } from './types.js'

describe('effectivePlayMode', () => {
  it.each<[PlayMode, PlayMode]>([
    ['sequential', 'sequential'],
    ['loop-all', 'loop-all'],
    ['loop-one', 'loop-one'],
    ['shuffle', 'shuffle'],
  ])('leaves %s as it is in a queue that keeps its tracks', (mode, expected) => {
    expect(effectivePlayMode('keep', mode)).toBe(expected)
    // A room from before the setting existed is a room that keeps its tracks.
    expect(effectivePlayMode(undefined, mode)).toBe(expected)
  })

  it('plays the looping modes in order once the queue is consumed, and nothing else', () => {
    expect(effectivePlayMode('consume', 'loop-all')).toBe('sequential')
    expect(effectivePlayMode('consume', 'loop-one')).toBe('sequential')
    expect(effectivePlayMode('consume', 'sequential')).toBe('sequential')
    expect(effectivePlayMode('consume', 'shuffle')).toBe('shuffle')
  })
})

describe('roomSettingsSchema queue mode', () => {
  it.each(['keep', 'consume'])('accepts %s on its own', (queueMode) => {
    expect(roomSettingsSchema.parse({ queueMode })).toEqual({ queueMode })
  })

  it('takes it together with the other settings, and without it', () => {
    expect(roomSettingsSchema.parse({ name: 'Room', queueMode: 'consume' })).toEqual({
      name: 'Room',
      queueMode: 'consume',
    })
    expect(roomSettingsSchema.parse({ name: 'Room' })).toEqual({ name: 'Room' })
  })

  it.each(['loop', 'CONSUME', '', 1, null])('refuses %j', (queueMode) => {
    expect(roomSettingsSchema.safeParse({ queueMode }).success).toBe(false)
  })
})
